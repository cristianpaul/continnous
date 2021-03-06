const NodeMailer = require('nodemailer');

let transport;

/**
 * Base class for backends
 *
 * @type {AbstractNotifier}
 */
module.exports = class AbstractNotifier {
  /**
   * Constructor
   *
   * @param {Object} organization
   * @param {FirebaseApp} firebase
   * @param {Object} rc
   */
  constructor(organization, firebase, rc) {
    this.organization = organization;
    if (!this.organization.title) {
      this.organization.title = this.organization.name + ' Innovation Platform';
    }
    this.db = firebase.database();
    this.fb = firebase;
    this.rc = rc;
    if (!organization.domain) {
      let initialized = false;
      this.db.ref('domains').orderByValue().equalTo(organization.key).on('value', (sn) => {
        organization.domain = undefined;
        sn.forEach((dsn) => {
          if (!organization.domain) {
            organization.domain = dsn.key.replace(/:/g, '.');
          }
        });
        if (!initialized) {
          initialized = true;
          this.init();
        }
      });
    } else {
      this.init();
    }
  }

  /**
   * Initialize - called from constructor, override from child class
   */
  init() {
  }

  /**
   * Load a user
   *
   * @param {String} uid
   *
   * @returns {Promise}
   */
  getUser(uid) {
    return new Promise((resolve, reject) => {
      this.db.ref('users/organizations/' + this.organization.key + '/' + uid).once('value', (sn) => {
        sn.exists() ? resolve(Object.assign({ uid }, sn.val())) : reject();
      });
    });
  }

  /**
   * Load an item - tryArchiveOpposite and item could not be found in the
   * first place, it will be attempted to be loaded from the opposite place
   *
   * @param {String} id
   * @param {String} type
   * @param {Boolean} archive
   * @param {Boolean} [tryArchiveOpposite]
   *
   * @returns {Promise}
   */
  getItem(id, type, archive, tryArchiveOpposite) {
    return new Promise((resolve, reject) => {
      const path = '/' + (archive ? 'archive' : 'resources')
        + '/organizations/' + this.organization.key + '/organization'
        + '/' + type + '/' + id;
      this.db.ref(path).once('value', (isn) => {
        const item = isn.val();
        item.id = id;
        item.archive = archive;
        if (item) {
          resolve(item);
        } else if (tryArchiveOpposite) {
          this.getItem(id, type, !archive).then(resolve, reject);
        } else {
          reject();
        }
      });
    });
  }

  /**
   * Get the watchers for an item
   *
   * @param {Object} item
   * @param {Array} [excludeUids]
   *
   * @returns {Promise}
   */
  getWatchers(item, excludeUids) {
    const org = this.organization.key;
    const watchers = [];
    const ref = this.db.ref('watchers/organizations/' + org + '/' + item.id);
    return new Promise((resolve) => {
      const uids = [item.creator];
      ref.once('value', (wsn) => {
        wsn.forEach((wcsn) => {
          const i = uids.indexOf(wcsn.key);
          if (i === -1 && wcsn.val() === true) {
            uids.push(wcsn.key);
          } else if (i > -1 && wcsn.val() === false) {
            uids.splice(i, 1);
          }
        });
        resolve(uids.filter(uid => !excludeUids || excludeUids.indexOf(uid) < 0));
      });
    }).then(
      (uids) => Promise.all(
        uids.map(
          (uid) => new Promise((resolve) => {
            this.db.ref('/security/organizations/' + org + '/users/' + uid).once('value', (ugsn) => {
              if (ugsn.val() === '?' || ugsn.val() === '!') {
                resolve();
                return;
              }
              this.getUser(uid).then(
                (user) => {
                  watchers.push(user);
                  resolve();
                },
                () => ref.child(uid).remove().then(resolve)
              );
            });
          })
        )
      )
    ).then(() => watchers);
  }

  /**
   * Get an email address for email from/to
   *
   * @param {String} [name]
   * @param {String} [email]
   *
   * @returns {String}
   */
  emailAddress(name, email) {
    return '"' + (name || this.organization.title) + '" '
      + '<' + (email || ('noreply@' + (this.organization.domain || this.rc.config.authDomain))) + '>';
  }

  /**
   * Get the URL to an organization
   *
   * @param {String} path
   *
   * @returns {String}
   */
  href(path) {
    return 'https://' + (this.organization.domain || this.rc.config.authDomain + '/' + this.organization.key)
      + (path ? ('/' + path).replace(/^\/+/, '/') : '')
  }

  /**
   * Send an email with nodemailer
   *
   * @param {Object} mail
   *
   * @returns {Promise}
   */
  sendMail(mail) {
    mail.subject = '[' + this.organization.title + '] ' + mail.subject;
    if (!transport) {
      transport = NodeMailer.createTransport(this.rc.transport);
    }
    return transport.sendMail(mail).then(
      (info) => {
        console.log('Sent mail:'.green);
        console.log(info);
      },
      (error) => {
        console.error('Mail delivery failed');
        console.error(error);
      }
    );
  }

  /**
   * Get all admins for the current organization
   *
   * @returns {Promise}
   */
  getAdmins() {
    return new Promise((resolve, reject) => {
      this.db.ref('/security/organizations/' + this.organization.key + '/users')
        .orderByValue().equalTo('admin')
        .once('value', (asn) => {
          const admins = [];
          let load = 0;
          asn.forEach((acsn) => {
            load++;
            this.db.ref('users/organizations/' + this.organization.key + '/' + acsn.key).once('value', (ausn) => {
              admins.push(Object.assign({ uid: acsn.key }, ausn.val()));
              load--;
              if (!load) {
                resolve(admins);
              }
            }, reject);
          });
          if (!load) {
            console.error('No admins found for organization %s'.red, this.organization.key);
            resolve(admins);
          }
        }, reject);
    });
  }

  sendAdminMails(mail) {
    this.getAdmins().then((admins) => {
      admins.forEach((admin) => {
        this.sendMail(Object.assign({
          to: this.emailAddress(admin.displayName, admin.email)
        }, mail));
      });
    });
  }

  /**
   * Called from outside when organization was updated
   *
   * @private
   * @param organization
   */
  updateOrganization(organization) {
    this.organization = organization;
  }
}
