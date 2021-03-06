<template>
  <div>
    <p class="md-caption">{{$tc('permission', 2)}}</p>
    <card-form
        ref="form"
        class="permissions"
        :firebase-path="'/security/organizations/' + Current.organization.key + '/permissions'"
        :firebase-bind="true"
        :firebase-receive="firebaseReceive"
        :keys="roles"
        @saved="onSaved"
    >
      <template scope="form">
        <div class="md-table">
          <table>
            <thead class="md-table-header">
            <tr class="md-table-row">
              <th class="md-table-head md-sorted">
                <div class="md-table-head-container">
                  <div class="md-table-head-text">{{$tc('permission', 1)}}</div>
                </div>
              </th>
              <th class="md-table-head md-sorted" v-for="role in roles">
                <div class="md-table-head-container">
                  <div class="md-table-head-text">{{$t('roles.' + role)}}</div>
                </div>
              </th>
            </tr>
            </thead>
            <tbody class="md-table-body">
            <template v-for="(privileges, resource) in defaultPermissions[roles[0]]">
              <tr class="md-table-row permissions-resource">
                <td class="md-table-cell" :colspan="roles.length + 1">
                  <div class="md-table-cell-container">
                    {{resource.substr(0, 9) === 'personal_' ? $t(resource.substr(9) + '.personal') : $tc(resource + '.title', 2)}}
                  </div>
                </td>
              </tr>
              <tr class="md-table-row" v-for="(defaultAllowed, privilege) in privileges">
                <td class="md-table-cell">
                  <div class="md-table-cell-container">{{$t('actions.' + privilege)}}</div>
                </td>
                <td class="md-table-cell" v-for="role in roles">
                  <div class="md-table-cell-container">
                    <md-switch :value="form.values[role] && form.values[role][resource] && form.values[role][resource][privilege]" @click.native="onPermissionsChange(role, resource, privilege)"></md-switch>
                  </div>
                </td>
              </tr>
            </template>
            </tbody>
          </table>
        </div>
      </template>

      <md-button slot="secondaryButtons" @click.native="resetPermissionsToDefaults()" class="md-dense">{{$t('actions.resetToDefaults')}}</md-button>
    </card-form>
  </div>
</template>

<script>
  import extend from 'extend';
  import CardForm from '../../../form/Card';
  import Config from '../../../../models/Config';
  import Permissions from '../../../../models/Permissions';
  import Flashlight from '../../../../models/Flashlight';
  import Current from '../../../../models/Current';

  export default {
    components: {
      CardForm
    },
    data() {
      const defaultPermissions = Permissions.getDefaults();
      return {
        defaultPermissions,
        roles: Config.roles,
        Current
      };
    },
    methods: {
      firebaseReceive(snapshot) {
        return extend(true, {}, snapshot.val() || {});
      },
      onPermissionsChange(role, resource, privilege) {
        const form = this.$refs.form;
        const newRolePermissions = extend(true, {}, form.values[role]);
        if (!newRolePermissions.hasOwnProperty(resource)) {
          newRolePermissions[resource] = {};
        }
        if (!newRolePermissions[resource].hasOwnProperty(privilege)) {
          newRolePermissions[resource][privilege] = false;
        }
        newRolePermissions[resource][privilege] = !newRolePermissions[resource][privilege];
        form.onChange(role, newRolePermissions);
      },
      resetPermissionsToDefaults() {
        const form = this.$refs.form;
        this.roles.forEach((role) => {
          const newVal = extend(true, {}, this.defaultPermissions[role]);
          form.onChange(role, newVal);
          form.values[role] = newVal;
        });
      },
      onSaved() {
        Flashlight.updatePaths(
          Current.organization.key,
          'organization',
          Permissions.merge(true, ...this.$objectValues(this.$refs.form.values))
        );
      }
    }
  };
</script>

<style lang="scss" rel="stylesheet/scss">
  .permissions {
    tr.permissions-resource .md-table-cell {
      background: #F5F5F5 !important;
      font-weight: 500;
    }
  }
</style>