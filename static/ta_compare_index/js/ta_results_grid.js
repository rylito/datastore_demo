function TAResultsGrid(container_id, baseline_order, ds, color_gradient, overview_table_obj, col_comparator_obj){

    const NO_VALUE_PLACEHOLDER = '-' //string to use for success rate cells with no value
    const SCENARIO_RESULTS_KEY = 'scenario_results'
    const VP_ITEMS_KEY = 'vp_items'


    var num_baselines = baseline_order.length

    var scenario_data = []

    for(const col_iter of ds.select('SCENARIO').order_by('scenario_name')){
        var col_dict = col_iter.dict()
        col_dict[SCENARIO_RESULTS_KEY] = col_iter.get_related('SUCCESS_RATE', 'for_scenario').exclude(['for_baseline', 'for_scenario']).as_dict(['for_baseline', 'pk'])
        col_dict[VP_ITEMS_KEY] = col_iter.get_related('SCENARIO_VP_ITEM', 'for_scenario').one('value').as_dict(['for_vp_item','key'])
        scenario_data.push(col_dict)
    }


    var column_def_count_prior_to_baselines;

    var filter_sets = {}

    var set_filter = new SetFilter(filter_sets)

    // external filter that is set by this.register_external_filter
    var external_filter_obj_instance;

    var column_defs = [
        {
            'headerName': "Scenario Name",
            'field': 'scenario_name',
            'cellRenderer': function(params){
                var data = params['data']
                var name = data['scenario_name']
                var link = data['url']
                return '<a href="' + link + '">' + name + '</a>'
            },
            'cellClass': function(params){
                var data = params['data']
                var sr_data = data[SCENARIO_RESULTS_KEY]
                return col_comparator_obj.get_css_class(sr_data)
            },
        },
        {'headerName': "Functional Cluster", 'field': "fc", 'filter': set_filter},
        {'headerName': "Machine Type", 'field': "machine_type", 'filter': set_filter},
        {'headerName': "Configuration ID", 'field': "configuration_id"},
    ]

    var grid_options = {
        'columnDefs': column_defs,
        'rowData': scenario_data,
        'enableSorting': true,
        'enableFilter': true,
        'suppressMovableColumns': true,
        'suppressColumnVirtualisation': true, // TODO this is a bit of a hack to keep the overview cols synced up
        'suppressMenuHide': true,
        'domLayout': 'autoHeight',
        'suppressColumnMoveAnimation': true,
        'onModelUpdated': function(){
            overview_table_obj.reset_accums()
            this.api.forEachNodeAfterFilter(function(n,i){
                overview_table_obj.update_accums(n['data'][SCENARIO_RESULTS_KEY])
            })
            overview_table_obj.recalc_accums()
        },
        'isExternalFilterPresent': function(){
            return external_filter_obj_instance && external_filter_obj_instance.is_active()
        },
        'doesExternalFilterPass': function(node){
            // shouldn't get called if isExternalFilterPresent returns false
            return external_filter_obj_instance.passes(node)
        }
    };


    function build_filter_sets(){
        $.each(column_defs, function(i,n){
            if(n['filter'] === set_filter){
                filter_sets[n['field']] = new Set()
            }
        })

        $.each(scenario_data, function(data_index, data_row){
            $.each(filter_sets, function(col_field, distinct_set){
                if(col_field.startsWith(VP_ITEMS_KEY)){
                    var value = data_row[VP_ITEMS_KEY][col_field.slice(VP_ITEMS_KEY.length + 1)]
                    if(value !== undefined){
                        distinct_set.add(value)
                    }
                }
                else{
                    distinct_set.add(data_row[col_field])
                }
            })
        })
    }


    function build_grid(){

        // set number of columns prior to adding baseline columns to column_defs. Used to
        // accesses the baseline col headers of the rendered grid to set size of overview table columns)
        column_def_count_prior_to_baselines = column_defs.length


        for(const col_iter of ds.select('VP_ITEM').order_by('key')){
            var vp_name = col_iter.one('key')
            var field_name = VP_ITEMS_KEY + '.' + vp_name
            column_defs.push({
                'headerName': vp_name,
                'field': field_name,
                'hide': true,
                'valueFormatter': function(params){
                    return (params.value === null) ? NO_VALUE_PLACEHOLDER : params.value
                },
                'filter': set_filter
            })
        }


        // add 'success rate' columns as needed for each baseline
        baseline_order.forEach(function(baseline_name_pk){
            column_defs.push({
                'headerName': "Success Rate %",
                'field': 'scenario_results.' + baseline_name_pk['pk'] + '.overall',
                'valueFormatter': function(params){
                    return (params.value === null) ? NO_VALUE_PLACEHOLDER : params.value
                },
                'cellStyle': function(params){
                    var style_obj = {}
                    if(params.value !== null){
                        style_obj = {'backgroundColor': color_gradient.get_color(params.value)}
                    }
                    return style_obj
                },
                'filter': 'agNumberColumnFilter'
            })
        })

        // lookup the container we want the Grid to use
        var grid_container = document.querySelector(container_id);

        // create the grid passing in the div to use together with the columns & data we want to use
        new agGrid.Grid(grid_container, grid_options);

        // make columns use available width
        //grid_options.api.sizeColumnsToFit()
    }


    function set_overview_col_widths(){
        // the following is hackish until a better way is found
        var baseline_col_start_slice = column_def_count_prior_to_baselines
        var baseline_col_end_slice = baseline_col_start_slice + num_baselines

        // TODO another hack: due to the way the CSS works in the overview grid, just set the 'left' posn to that
        // of the first elemnt for all baseline cols
        var first_offset;
        var widths = []
        $(container_id).find('.ag-header-cell').slice(baseline_col_start_slice, baseline_col_end_slice).each(function(i,n){
            var $el = $(this)
            if(i === 0){
                first_offset = $el.position()['left']
            }
            var width = $el.css('width')
            widths.push(width)
        })

        var overview_width = overview_table_obj.set_baseline_col_posn(first_offset, widths)

        // set table width to fit all columns if they exceed the viewport size
        $(container_id).width(overview_width)
        grid_options.api.doLayout()

        //TODO there's probably a better way to do this so that tables with a few columns (less than screen width)  expand to fill the screen
        //while tables with many columns that flow off the screen still work/scroll correctly

    }

    //init actions

    build_grid()
    build_filter_sets()
    set_overview_col_widths()

    // public methods

    this.register_external_filter = function(external_filter_obj){
        external_filter_obj.set_callback(function(){
            grid_options.api.onFilterChanged()
        })

        external_filter_obj_instance = external_filter_obj
    }

    this.select_col = function(selected_col, visible){
        var col_key = VP_ITEMS_KEY + '.' + selected_col
        grid_options.columnApi.setColumnVisible(col_key, visible)

        //if vp_item col is hidden, remove any filtering applied to that col
        if(!visible){
            var col_filter = grid_options.api.getFilterInstance(col_key)
            col_filter.setModel(null)
        }

        var col_width = grid_options.columnApi.getColumn(col_key).actualWidth

        //adjust the overview table width
        var overview_width = overview_table_obj.adjust_width(col_width * (visible ? 1 : -1))

        //adjust the ag-grid width
        $(container_id).width(overview_width)
        grid_options.api.doLayout()

    }

    this.reset_filters = function(){
        grid_options.api.setFilterModel(null);
        external_filter_obj_instance.reset()
        grid_options.api.onFilterChanged();
    }

    this.download_csv = function(overview_csv_data){
        grid_options.api.exportDataAsCsv({
            'customHeader': overview_csv_data,
            'processHeaderCallback': function(params){
                //TODO there might be a cleaner way to do this but for now, re-name the 'Success %' column headers by adding the baseline name
                //parsed from the column field namd
                var col_def = params['column']['colDef']
                var header_name = col_def['headerName']
                var field_name = col_def['field']
                var start_key = 'scenario_results.'
                var end_key = '.overall'
                if(field_name.startsWith(start_key)){
                    var bl_pk_start = start_key.length
                    var bl_pk_end = field_name.length - bl_pk_start - end_key.length
                    var bl_pk = field_name.substr(bl_pk_start, bl_pk_end)
                    var bl_name = ds.lookup_record('BASELINE', 'pk', bl_pk).one('name')
                    return bl_name + ' ' + header_name
                }
                return header_name
            }
        })
    }

}
