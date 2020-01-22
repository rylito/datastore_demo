'use strict'

//TODO experiment with using prototypes for common methods instead of member methods for performance in the future

function DataStore(load_data){

    // util functions

    function each(obj, callback){
        for(const key in obj){
            if(obj.hasOwnProperty(key)){
                callback(key, obj[key])
            }
        }
    }

    function map(obj, callback){
        let return_dict = {}
        for(const key in obj){
            if(obj.hasOwnProperty(key)){
                let cb_val = callback(key, obj[key])
                return_dict[cb_val[0]] = cb_val[1]
            }
        }
        return return_dict
    }

    function setdefault(obj, key, default_val){
        let val = obj[key]
        if(val === undefined){
            obj[key] = val = default_val
        }
        return val
    }

    function as_list(val){
        // convert single string to list
        return Array.isArray(val) ? val : [val]
    }

    // helpers for RowIter and ColIter prototypes

    function _only(table_obj, col_names_list){
        col_names_list = as_list(col_names_list)
        let filtered_col_indexes = col_names_list.map(function(col_name){
            return table_obj._col_name_index_map[col_name]
        })
        filtered_col_indexes.sort()
        return filtered_col_indexes
    }

    function _exclude(table_obj, col_names_list){
        col_names_list = as_list(col_names_list)
        let filtered_col_indexes = []
        for(let col_index = 0, count = table_obj._col_defs.length; col_index < count; col_index++){
            let col_name = table_obj._col_defs[col_index]['name']
            if(col_names_list.indexOf(col_name) == -1){
                filtered_col_indexes.push(col_index)
            }
        }
        // sorting not necessary here because we iterated over table_obj._col_defs
        return filtered_col_indexes
    }

    function RowIter(table_obj){
        this._table_obj = table_obj
        this._record_index_selection = null
        this._sort_order = null
        this._filtered_col_indexes = null
        this._rows_as_lists = false
        this._one_col_name_array = null
    }

    // helper for RowIter prototypes
    //TODO port this to Python

    RowIter.prototype._get_col_iter_data = function(col_iter){
        if(this._one_col_name_array !== null){
            return col_iter.one(this._one_col_name_array)
        }

        return this._rows_as_lists ? col_iter.values() : col_iter.dict()
    }


    //methods 'pass-thru' to ColIter
    //TODO port these to Python

    RowIter.prototype.only = function(col_names_list){
        this._filtered_col_indexes = _only(this._table_obj, col_names_list)
        return this
    }

    RowIter.prototype.exclude = function(col_names_list){
        this._filtered_col_indexes = _exclude(this._table_obj, col_names_list)
        return this
    }

    RowIter.prototype.values = function(){
        this._rows_as_lists = true
        return this
    }

    RowIter.prototype.one = function(col_name_array){
        this._one_col_name_array = col_name_array
        return this
    }

    //TODO queue these operations to ensure that a select_by/where always occurs
    //before an order_by

    RowIter.prototype.where = function(col_name, val){
        let indexed_col_selection = this._table_obj._indexes[col_name]

        if(indexed_col_selection === undefined){
            let indexes = {}
            let col_index = this._table_obj._col_name_index_map[col_name]
            for(let record_index = 0, count = this._table_obj._data.length; record_index < count; record_index++){
                let col_val = this._table_obj._data[record_index][col_index]
                setdefault(indexes, col_val, []).push(record_index)
            }
            this._table_obj._indexes[col_name] = indexed_col_selection = indexes
        }

        this._record_index_selection = indexed_col_selection[val] || []
        this._sort_order = null // any previous ordering is useless now
        return this
    }

    RowIter.prototype.order_by = function(col_name, sort_numeric){
        this._sort_order = []
        let col_index = this._table_obj._col_name_index_map[col_name]
        let is_subset = this._record_index_selection !== null
        let use_count = is_subset ? this._record_index_selection.length : this._table_obj._data.length
        for(let iter_index = 0; iter_index < use_count; iter_index++){
            let record_index = is_subset ? this._record_index_selection[iter_index] : iter_index
            this._sort_order.push([this._table_obj._data[record_index][col_index], record_index])
        }

        if(sort_numeric){
            this._sort_order.sort(function(a, b){return a[0] - b[0]})
        }
        else{
            this._sort_order.sort()
        }

        return this
    }

    RowIter.prototype[Symbol.iterator] = function(){
        //TODO implement as generator to simplify this a bit?
        let table_obj = this._table_obj
        let iteration_count = 0
        let is_sorted = (this._sort_order !== null)
        let use_selection = is_sorted ? this._sort_order : this._record_index_selection
        let count = (use_selection === null) ? table_obj._data.length : use_selection.length
        let filtered_col_indexes = this._filtered_col_indexes

        return {
            'next': function(){
                if(iteration_count >= count){
                    return {'done': true}
                }
                let i = iteration_count++
                let record_index = (use_selection === null) ? i : use_selection[i]
                if(is_sorted){
                    record_index = record_index[1]
                }
                return {'value': new ColIter(table_obj, record_index, filtered_col_indexes), 'done': false}
            }
        }
    }

    RowIter.prototype.as_list = function(){
        let row_iter_list = []
        for(const col_iter of this){
            row_iter_list.push(this._get_col_iter_data(col_iter))
        }
        return row_iter_list
    }

    RowIter.prototype.as_dict = function(col_as_key){
        let row_iter_dict = {}
        for(const col_iter of this){
            row_iter_dict[col_iter.one(col_as_key)] = this._get_col_iter_data(col_iter)
        }
        return row_iter_dict
    }


    function ColIter(table_obj, record_index, filtered_col_indexes){
        this._table_obj = table_obj
        this._record_index = record_index
        this._record = table_obj._data[record_index]
        this._filtered_col_indexes = filtered_col_indexes || null
    }

    // helper for ColIter prototypes

    function _get_val_or_col_iter(table_obj, record, col_index){
        let val = record[col_index]
        let col_def = table_obj._col_defs[col_index]
        let col_fk_table = col_def['fk_table']
        if((col_fk_table !== undefined) && (val !== null)){
            val = new ColIter(col_fk_table, val)
        }
        return [col_def['name'], val]
    }

    ColIter.prototype[Symbol.iterator] = function(){
        //TODO implement as generator to simplify this a bit?
        let table_obj = this._table_obj
        let record = this._record
        let iteration_count = 0
        let filtered_col_indexes = this._filtered_col_indexes
        let is_filtered = (filtered_col_indexes !== null)
        let count = is_filtered ? filtered_col_indexes.length : table_obj._col_defs.length

        return {
            'next': function(){
                if(iteration_count >= count){
                    return {'done': true}
                }
                let i = iteration_count++
                let col_index = is_filtered ? filtered_col_indexes[i] : i
                let val = _get_val_or_col_iter(table_obj, record, col_index)
                return {'value': val, 'done': false}
            }
        }
    }

    ColIter.prototype.get_related = function(table_name, fk_col_name){
        let related_table_obj = this._table_obj._related_fk[table_name][fk_col_name]
        let row_iter = new RowIter(related_table_obj)
        row_iter.where(fk_col_name, this._record_index)
        return row_iter
    }

    ColIter.prototype.only = function(col_names_list){
        this._filtered_col_indexes = _only(this._table_obj, col_names_list)
        return this
    }

    ColIter.prototype.exclude = function(col_names_list){
        this._filtered_col_indexes = _exclude(this._table_obj, col_names_list)
        return this
    }


    ColIter.prototype.one = function(col_name_array){
        // col_name_array allows for deep lookups of nested FK records
        //TODO would this be better with dot notation? It would mean that we would have to enforce that
        // dots can't be in string column names
        col_name_array = as_list(col_name_array)

        let col_name_index = 0

        let col_index = this._table_obj._col_name_index_map[col_name_array[col_name_index]]
        let val = _get_val_or_col_iter(this._table_obj, this._record, col_index)[1]

        while(++col_name_index < col_name_array.length){
            val = val.one(col_name_array[col_name_index])
        }

        return val
    }

    ColIter.prototype.values = function(){
        let row_list = []
        for(const pair of this){
            let val = pair[1]
            row_list.push((val instanceof ColIter) ? val.as_list() : val)
        }
        return row_list
    }

    ColIter.prototype.dict = function(){
        let row_dict = {}
        for(const pair of this){
            let col_name = pair[0]
            let val = pair[1]
            row_dict[col_name] = (val instanceof ColIter) ? val.as_dict() : val
        }
        return row_dict
    }




    function Table(name, load_data){

        this._col_defs = []
        this._col_name_index_map = {}
        this._data = []

        // {TABLE_NAME: {COL_NAME: table_obj} }
        this._related_fk = {}

        // {COL_NAME: {val:[pks..]}}
        this._indexes = {}

        // {record_hash: record_index}
        let _hash_cache = null

        this.schema = []

        this.init = function(){
            let col_defs_raw
            if(Array.isArray(load_data)){
                col_defs_raw = load_data
            }
            else{
                col_defs_raw = load_data['columns']
                this._data = load_data['data'] || []
            }

            for(let i=0; i < col_defs_raw.length; i++){
                let col_def = col_defs_raw[i]
                let col_def_dict = {}
                let col_name
                let schema
                if(typeof col_def === 'object'){ //TODO is a more robust check needed here?
                    col_name = col_def['name']
                    col_def_dict['name'] = col_name
                    let fk_table_name = col_def['fk']
                    if(fk_table_name !== undefined){
                        let fk_table = _table_dict[fk_table_name]
                        col_def_dict['fk_table'] = fk_table
                        setdefault(fk_table._related_fk, name, {})[col_name] = this
                        schema = {'name': col_name, 'fk': fk_table_name}
                    }
                }
                else{
                    col_def_dict['name'] = col_name = col_def
                }

                this._col_defs.push(col_def_dict)
                this._col_name_index_map[col_name] = i

                this.schema.push(schema || col_name)
            }
        }

        this.serialize = function(){
            return {'columns': this.schema, 'data': this._data}
        }


    }

    let _table_dict = {}

    this.schema = {}

    const self = this

    each(load_data, function(table_name, table_data){
        let table = new Table(table_name, table_data)
        _table_dict[table_name] = table
    })

    each(_table_dict, function(table_name, table){
        table.init()
        self.schema[table_name] = table.schema
    })

    this.serialize = function(){
        return map(_table_dict, function(table_name, table_obj){
            return [table_name, table_obj.serialize()]
        })
    }

    this.select = function(table_name){
        return new RowIter(_table_dict[table_name])
    }

    this.get_record = function(table_name, record_index){
        return new ColIter(_table_dict[table_name], record_index)
    }

    this.lookup_record = function(table_name, col_name, val){
        let row_iter = new RowIter(_table_dict[table_name])
        row_iter.where(col_name, val)
        for(const col_iter of row_iter){
            return col_iter
        }
        return null
    }

    this.insert = function(table_name, data){
        return _table_dict[table_name].insert(data)
    }

    this.insert_many = function(table_name, data_list){
        let table_obj = _table_dict[table_name]
        data_list.forEach(function(data_dict){
            table_obj.insert(data_dict)
            //TODO return a list of inserted indexes here? Not sure why we would ever need this...
        })
    }
}
