import json
from django.views.generic.base import TemplateView
from django.http import JsonResponse
from django.urls import reverse

from datastore_demo.data_store import DataStore


class AgGridView(TemplateView):

    template_name = "datastore/ag_grid.html"

    def get_context_data(self, **kwargs):
        context = super(AgGridView, self).get_context_data(**kwargs)
        context['api_url'] = reverse('datastore_api:api-mock-ag-grid-data', args=[], kwargs={})
        return context


def ag_grid_mock_data_view(request):
    with open('datastore_demo/demo_data.json','r') as f:
        data = json.load(f)

    # insert mock data to DataStore

    schema = {
        'BASELINE': ['name', 'status', 'url', {'name': 'pk', 'hash_key': True}],
        'VP_ITEM': ['key', 'count'],
        'SCENARIO_VP_ITEM': [{'name': 'for_scenario', 'fk': 'SCENARIO'}, {'name': 'for_vp_item', 'fk': 'VP_ITEM'}, 'value'],
        'SCENARIO': ['scenario_name', {'name': 'url', 'hash_key': True}, 'fc', 'machine_type', 'configuration_id'],
        'SUCCESS_RATE': [{'name': 'for_scenario', 'fk': 'SCENARIO'}, {'name': 'for_baseline', 'fk': 'BASELINE'}, 'overall', 'nr_failed', 'nr_passed', 'nr_tests', 'nr_skipped'],
        'OVERVIEW': ['header', 'data_key', 'recalc', 'format'],
    }

    ds = DataStore(schema)

    ds.insert_many('SCENARIO_VP_ITEM', data['SCENARIO_VP_ITEM'])
    ds.insert_many('SUCCESS_RATE', data['SUCCESS_RATE'])
    ds.insert_many('OVERVIEW', data['OVERVIEW'])

    return JsonResponse(ds.serialize())



