function ExternalFilter(container_id, col_comparator_obj){

    const SELECT_ALL = 'all'
    const SELECT_CHANGE = 'change'
    const SELECT_NEG_CHANGE = 'neg_change'

    var filter_changed_callback;

    // ['option val', 'option text']
    var external_filter_defs = [
        [SELECT_ALL, 'All Rows'],
        [SELECT_CHANGE, 'Show Rows with Change'],
        [SELECT_NEG_CHANGE, 'Show Rows with Negative Change']
    ]


    var external_filter_val = external_filter_defs[0][0]
    var $external_filter

    function build_external_filter(){
        var select_id = 'ext-filter-change-select'

        var $label = e('label', {'for': select_id}, 'Filter by Change')

        $external_filter = e('select', {'id': select_id, 'style': {'margin': '0 10px'}},
            $.map(external_filter_defs, function(n, i){
                return e('option', {'value': n[0]}, n[1])
            })
        )

        $external_filter.on('change',function(){
            external_filter_val = $(this).val()
            filter_changed_callback()
        })

        $(container_id).append($label ,$external_filter)
    }

    // init
    build_external_filter()

    // public methods

    this.set_callback = function(callback){
        filter_changed_callback = callback
    }

    this.is_active = function(){
        return external_filter_val !== external_filter_defs[0][0]
    }

    this.passes = function(node){
        if(external_filter_val === SELECT_ALL){
            return true
        }

        var data = node['data']
        var sr_data = data['scenario_results']
        var comp_result = col_comparator_obj.compare(sr_data)

        var absent = col_comparator_obj.ABSENT
        var deter = col_comparator_obj.DETERIORATED
        var nochange = col_comparator_obj.NOCHANGE
        var improved = col_comparator_obj.IMPROVED

        if(external_filter_val === SELECT_CHANGE){
            if(comp_result === deter || comp_result === improved || comp_result === absent){
                return true
            }
        }
        else if(comp_result === absent || comp_result === deter){ // SELECT_NEG_CHANGE implied
            return true
        }

        return false
    }

    this.reset = function(){
        $external_filter.val(external_filter_defs[0][0]).trigger('change')
    }

}

