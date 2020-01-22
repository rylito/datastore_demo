function OverviewTable(container_id, baseline_order, ds, full_view_link){

    var all_rows_defs = ds.select('OVERVIEW').as_list()

    var overview_data_store = {}

    var overview_cell_formatters = {
        'link': function($cell, val){
            var $a = $('<a>')
            $a.attr('href',val)
            $a.text('link')
            $cell.append($a)
        },
        'status': function($cell, val){
            var cls = (val === 'NOK') ? 'bg-red' : 'bg-green'
            $cell.addClass('status ' + cls)
            $cell.text(val)
        }
    }

    // helper to iterate over each column key in the data store

    function each_col(callback_func){
        $.each(overview_data_store,function(col_name, row_defs){
            callback_func(col_name, row_defs['cells'])
        })
    }

    // helper to iterate over each cell def item for a given row def in the data store

    function each_cell_def(row_defs, callback_func){
        $.each(row_defs, function(row_index, cell_defs){
            var row_specs = all_rows_defs[row_index]
            callback_func(cell_defs, row_specs)
        })
    }


    // helper to iterate over each cell def item for each colmun key in the data store

    function each_row(callback_func){
        each_col(function(col_name, row_defs){
            each_cell_def(row_defs, function(cell_defs, row_specs){
                callback_func(col_name, cell_defs, row_specs)
            })
        })
    }


    function refresh_overview_table(initial){
        each_row(function(col_name, cell_defs, row_specs){
            if(initial || row_specs['recalc']){
                var formatter_func = overview_cell_formatters[row_specs['format']]
                var $cell = cell_defs['ref']
                var val = cell_defs['val']
                if(formatter_func){
                    formatter_func($cell, val)
                }
                else{
                    $cell.text(val)
                }
            }
        })
    }


    function get_overview_csv(){
        var csv_str = ',"' + baseline_order.map(function(bl){return bl['name']}).join('","') + '"\n'

        for(var i=0; i < all_rows_defs.length; i++){
            var def = all_rows_defs[i]
            csv_str += '"' + def['header'] + '"'

            baseline_order.forEach(function(bl){
                csv_str += ',"' + overview_data_store[bl['pk']]['cells'][i]['val'] + '"'
            })
            csv_str += '\n'
        }
        return csv_str
    }

    // helper to set baseline name cell heights
    function set_baseline_name_cell_height(height){
        $.each(overview_data_store, function(baseline_name, baseline_col_defs){
            $col = baseline_col_defs['col_ref']
            $col.children().eq(0).css('height', height + 'px')
        })
    }


    var viewport

    var $col_row_headers
    var $col_select

    var reset_handler
    var csv_handler
    var col_select_handler

    var col_select_state = []

    function build_overview_table(){
        var select_col_id = 'col-select'

        var $reset_button, $csv_button, $container = e('div', {'class': 'overview-viewport'},
            $col_row_headers = e('div', {'class': 'row-header-col'},
                e('div', {'class': 'filter-button-container'},
                    e('div', {'id': 'external_filter_container', 'style': {'border': 'none', 'display': 'inline-block', 'padding': 0}}),
                    $reset_button = e('button', {'class': 'btn btn-primary', 'id': 'filter_reset_button'}, 'Reset Filters'),
                    $csv_button = e('button', {'class': 'btn btn-primary'}, 'Download Data as CSV'),
                    full_view_link ? e('a', {'class': 'btn btn-primary', 'href': full_view_link}, 'Show All Baselines'): null,

                    e('div', {'style': {'border':'none', 'padding': '5px 0 0 0'}},
                        e('label', {'for': select_col_id, 'style': {'margin-right': '10px'}}, 'VP Items Columns'),
                        $col_select = e('select', {'multiple': true, 'id': select_col_id, 'style': {'width': '100%'}},
                            $.map(ds.select('VP_ITEM').order_by('key').one('key').as_list(), function(n, i){
                                return e('option', {'value': n}, n)
                            })
                        ),
                    )
                ),
                $.map(all_rows_defs, function(row_defs, row_count){
                    var row_header = row_defs['header']
                    return e('div', row_header)
                })
            ),
            $.map(baseline_order, function(col_name_pk, col_index){
                //use baseline pk as overview_data_store_key since names are not guaranteed to be unique
                var ods_key = col_name_pk['pk']
                overview_data_store[ods_key] = {'cells': []}
                var $col = e('div', {'class': 'overview-col'},
                    e('div', {'class': 'overview-baseline-header'}, col_name_pk['name']),
                    $.map(all_rows_defs, function(row_defs, row_count){
                        var row_header = row_defs['header']
                        var default_val = null
                        if(!row_defs['recalc'] && row_defs['data_key']){
                            default_val = ds.lookup_record('BASELINE', 'pk', ods_key).one(row_defs['data_key'])
                        }
                        var $cell = e('div')
                        overview_data_store[ods_key]['cells'].push({'val': default_val, 'ref': $cell})
                        return $cell
                    })
                )
                overview_data_store[ods_key]['col_ref'] =  $col
                return $col
            })
        )

        $reset_button.on('click', function(){
            reset_handler()
        })

        $csv_button.on('click', function(){
            csv_handler(get_overview_csv())
        })

        $col_select.select2({'width': 'style'}).on('change', function(){
            var new_state = $(this).val()

            //detect removed/hidden cols
            col_select_state.forEach(function(n){
                if(new_state.indexOf(n) === -1){
                    col_select_handler(n, false)
                }
            })

            //detect added/visible cols
            new_state.forEach(function(n){
                if(col_select_state.indexOf(n) === -1){
                    col_select_handler(n, true)
                }
            })

            // get the new height of the container select2 is in and adjust all other column headers accordingly
            // in case the select2 element expands vertically to accomodate options

            //TODO -10 compensates for border and padding (hackish)
            var hdr_height = $col_row_headers.children().eq(0).innerHeight() - 10

            // ensure the baseline name cells are equal height
            set_baseline_name_cell_height(hdr_height)

            col_select_state = new_state
        })

        viewport = $container
        $(container_id).append($container)

        refresh_overview_table(true)
    }


    // build the table and add it to the container on init
    build_overview_table()

    // public methods

    this.reset_accums = function(){
        each_row(function(col_name, cell_defs, row_specs){
            if(row_specs['recalc']){
                cell_defs['val'] = 0
            }
        })
    }

    this.update_accums = function(sr_data){
        $.each(sr_data, function(baseline_pk, sr_data_for_baseline){
            var row_defs = overview_data_store[baseline_pk]['cells']
            each_cell_def(row_defs, function(cell_defs, row_specs){
                var sd_key = row_specs['data_key']
                var recalc = row_specs['recalc']
                if(sd_key !== null && recalc){
                    cell_defs['val'] += sr_data_for_baseline[sd_key]
                }
            })
        })
    }

    this.recalc_accums = function(){
        each_col(function(col_name, row_defs){
            //TODO this is hackish and hardcoded - any way to make it more dynamic (i.e. specified in the JSON data?)
            var passed = row_defs[1]['val']
            var failed = row_defs[2]['val']
            if(!(passed + failed)){
                row_defs[4]['val'] = '-' //show this rather NaN which results when division by 0 occurs
            }
            else{
                row_defs[4]['val'] = Math.floor((passed * 100) / (passed + failed))
            }
        })
        refresh_overview_table(false)
    }

    this.set_baseline_col_posn = function(first_offset, widths){
        //TODO this is hackish - find a better way to do this when time permits

        $col_row_headers.css({'width': first_offset + 'px', 'left': '0px'})

        var tallest_cell = $col_row_headers.children().eq(0).outerHeight()
        var total_width = first_offset

        $.each(widths, function(i, width){
            var baseline_key = baseline_order[i]['pk']
            var $col = overview_data_store[baseline_key]['col_ref']

            // set offset and widths of baseline columns
            $col.css({'left': '0px', 'width': width})

            total_width += parseInt(width)

            var cell_height = $col.children().eq(0).outerHeight()
            if(tallest_cell < cell_height){
                tallest_cell = cell_height
            }
        })

        // ensure the baseline name cells are equal height
        set_baseline_name_cell_height(tallest_cell)

        // ensure the first row header cell is equal in height to the baseline name cells
        // use min-height here so element will expand vertically if necessary if children
        // such as select2 widget expand vertically
        $col_row_headers.children().eq(0).css('min-height', tallest_cell + 'px')

        // set the inner div width so that overflow:hidden works correctly
        viewport.css('width', total_width+'px')

        return total_width
    }

    // called when vp_items columns are hidden/shown
    this.adjust_width = function(width_adjustment){
        var header_width = $col_row_headers.width() + width_adjustment
        $col_row_headers.width(header_width)
        var viewport_width = viewport.width() + width_adjustment
        viewport.width(viewport_width)
        return viewport_width
    }


    // TODO hack until we come up with a better way to refactor the interactions of methods
    // using a dispatcher object of some sort
    this.register_reset_handler = function(callback){
        reset_handler = callback
    }

    this.register_csv_handler = function(callback){
        csv_handler = callback
    }

    this.register_col_select_handler = function(callback){
        col_select_handler = callback

        //set default VP Item selection
        var default_vp = ds.select('VP_ITEM').order_by('count', true).one('key').as_list().reverse()
        if(default_vp.length > 0){
            $col_select.val(default_vp.slice(0,1)).change()
        }

    }


}
