<template>
  <div class="scroll-container">
    <md-toolbar class="md-dense md-transparent md-nav-bar">
      <h2 class="md-title">{{$t('overview.title')}}</h2>
    </md-toolbar>
    <div class="scroll-content">
      <md-layout class="overview-section">
        <div class="overview-latest">
        </div>
        <md-layout md-column class="overview-journal">
          <p class="md-caption">{{$t('whatshot')}}</p>
          <md-card>
            <md-card-content style="padding-bottom: 16px;">
              <journal></journal>
            </md-card-content>
          </md-card>
        </md-layout>
        <md-layout md-column class="overview-latest" v-for="resources in [['objectives', 'ideas'], ['insights', 'roadmaps']]">
          <template v-for="resource in resources" v-if="latestItems[resource]">
            <p class="md-caption">
              {{$t(resource + '.latest')}} {{$tc(resource + '.title', 1)}}
              <template v-if="config[resource].periodical">
                in {{period.format()}}
              </template>
            </p>
            <resource-item :item="latestItems[resource]"></resource-item>
          </template>
        </md-layout>
      </md-layout>
    </div>
  </div>
</template>

<script>
  import Journal from './common/Journal';
  import mixin from './resources/mixin';
  import ResourceItem from './resources/ListItem';
  import Config from '../../models/Config';
  import Period from '../../models/Period';
  import Item from '../../models/Item';

  export default {
    components: { Journal, ResourceItem },
    mixins: [mixin],
    data() {
      const latestItems = {};
      Object.keys(Config.resources).forEach((resource) => {
        latestItems[resource] = undefined;
      });
      return { latestItems, period: new Period(), config: Config.resources };
    },
    created() {
      Object.keys(Config.resources).forEach((resource) => {
        let ref = Item.getFirebaseRef(resource);
        if (Config.resources[resource].periodical) {
          ref = ref.orderByChild('dueTime')
            .startAt(this.period.start)
            .endAt(this.period.end);
        } else {
          ref = ref.orderByKey();
        }
        ref.on('value', (sn) => {
          sn.forEach((snc) => {
            this.latestItems[resource] = new Item(resource, snc.key, snc.val());
          });
        }, () => {
          this.latestItems[resource] = undefined;
        });
      });
    },
  };
</script>

<style lang="scss" rel="stylesheet/scss">
  .overview-latest {
    margin: 0 16px;
    p:not(:first-child) {
      margin-top: 24px;
    }
  }
  .overview-journal {
    margin-left: -16px;
    margin-right: 16px;
  }
</style>