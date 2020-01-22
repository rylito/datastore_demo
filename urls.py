from django.conf.urls import url
from datastore_demo.views import AgGridView, ag_grid_mock_data_view

app_name = 'datastore_api'

urlpatterns = [
    url(r'^$', AgGridView.as_view()),
    url(r'^api/$', ag_grid_mock_data_view, name='api-mock-ag-grid-data'),
]
