
var filter_proto = {
    'init': function(params){
        this.selected = []
        this.value_getter = params['valueGetter']
        this.gui = this.build_gui(params)
    },
    'getGui': function(){
        return this.gui
    },
    'doesFilterPass': function(params){
        var col_val = this.value_getter(params)
        return $.inArray(col_val, this.selected) != -1
    },
    'isFilterActive': function(params){
        return this.selected.length
    },
    'setModel': function(model){
        if(!model){
            this.$select.val(model).trigger('change')
        }
    }
}

function SetFilter(filter_sets){

    var set_filter = function(){

        this.build_gui = function(params){
            var col_field = params['colDef']['field']
            var val_set = filter_sets[col_field]

            var $select, $div = e('div',
                $select = e('select', {'multiple': true},
                    $.map(Array.from(val_set), function(n, i){
                        return e('option', {'value': n}, n)
                    })
                )
            )

            $select.select2({'width':'300px'})

            var self = this
            $select.on('change', function(){
                self.selected = $(this).val()
                params.filterChangedCallback()
            })

            this.$select = $select

            return $div[0] // expects raw DOM element, not jQuery object
        }

    }

    set_filter.prototype = filter_proto


    return set_filter
}
