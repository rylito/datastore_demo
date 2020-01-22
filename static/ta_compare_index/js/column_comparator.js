function ColumnComparator(baseline_order){

    // TODO normally comparators return -1,0,1, but I am not sure how to deal with ABSENT
    this.ABSENT = 0
    this.DETERIORATED = 1
    this.NOCHANGE = 2
    this.IMPROVED = 3

    var class_mapping = {}
    class_mapping[this.ABSENT] = 'cell-hl-change-noval'
    class_mapping[this.DETERIORATED] = 'cell-hl-change-worse'
    class_mapping[this.IMPROVED] = 'cell-hl-change-better'

    // TODO in the future, this class will provide more dynamic functionality to determine what columns to compare. For now, just hardcode
    // values in the following helper methods

    function get_current(sr_data){
        var baseline_data = sr_data[baseline_order[0]['pk']]
        return baseline_data ? baseline_data['overall'] : null
    }

    function get_previous(sr_data){
        var baseline_data = sr_data[baseline_order[1]['pk']]
        return baseline_data ? baseline_data['overall'] : null
    }

    // public methods

    this.compare = function(sr_data){

        if(baseline_order.length == 1){
            return this.NOCHANGE
        }

        var prev = get_previous(sr_data)
        var cur = get_current(sr_data)

        if((cur === null) && (prev !== null)){
            return this.ABSENT
        }
        else if(cur > prev){
            return this.IMPROVED
        }
        else if(cur < prev){
            return this.DETERIORATED
        }
        return this.NOCHANGE
    }

    this.get_css_class = function(sr_data){
        return class_mapping[this.compare(sr_data)] || null
    }

}
