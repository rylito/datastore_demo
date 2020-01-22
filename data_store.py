#TODO return this in iter methods so they can be chained?
#TODO cache RowIter commands like only and exclude so that they aren't computed for every row
import pprint

# util methods

def _as_list(val):
    # convert single string to list
    return [val] if isinstance(val, basestring) else val


class RowIter(object):
    def __init__(self, table_obj):
        self._table_obj = table_obj
        self._record_index_selection = xrange(len(self._table_obj))
        self._sort_order = None

        self._reset()

    def _reset(self):
        self._iteration_count = 0

    #TODO queue these operations to ensure that a select_by/where always occurs
    # before an order_by

    def where(self, col_name, val):
        indexed_col_selection = self._table_obj._indexes.get(col_name)

        if indexed_col_selection is None:
            indexes = {}
            col_index = self._table_obj._col_name_index_map[col_name]
            for record_index in xrange(len(self._table_obj)):
                col_val = self._table_obj._data[record_index][col_index]
                indexes.setdefault(col_val, []).append(record_index)

            self._table_obj._indexes[col_name] = indexed_col_selection = indexes

        self._record_index_selection = indexed_col_selection.get(val, [])
        self._sort_order = None # any previous ordering is useless now

    def order_by(self, col_name):

        sort_order = []
        col_index = self._table_obj._col_name_index_map[col_name]
        for record_index in self._record_index_selection:
            sort_order.append((self._table_obj._data[record_index][col_index], record_index))
        sort_order.sort()
        self._sort_order = sort_order

    def __len__(self):
        return len(self._table_obj)

    def __iter__(self):
        return self

    def next(self):
        if self._iteration_count >= len(self._record_index_selection):
            raise StopIteration
        self._iteration_count += 1
        iteration = self._iteration_count - 1
        record_index = self._record_index_selection[iteration] if self._sort_order is None else self._sort_order[iteration][1]
        return ColIter(self._table_obj, record_index)

    # convenience methods

    def as_list(self, rows_as_lists=False):
        #TODO reset self._iteration_count?
        return [col_iter.as_list() if rows_as_lists else col_iter.as_dict() for col_iter in self]

    def as_dict(self, col_as_key, rows_as_lists=False):
        #TODO reset self._iteration_count?
        return {col_iter.get_by_name(col_as_key): (col_iter.as_list() if rows_as_lists else col_iter.as_dict()) for col_iter in self}

    # TODO port get_col from JS


class ColIter(object):
    def __init__(self, table_obj, record_index):
        self._table_obj = table_obj
        self._record_index = record_index
        self._record = table_obj._data[record_index]
        self._filtered_col_indexes = xrange(len(table_obj._col_defs))

        self._reset()

    def _reset(self):
        self._iteration_count = 0

    def only(self, col_names_list):
        col_names_list = _as_list(col_names_list)
        self._filtered_col_indexes = sorted(self._table_obj._col_name_index_map[col_name] for col_name in col_names_list)

    def exclude(self, col_names_list):
        #TODO slightly different approach in JS - iterated over mapped table._col_defs. re-port?
        col_names_list = _as_list(col_names_list)
        self._filtered_col_indexes = sorted(col_index for col_name, col_index in self._table_obj._col_name_index_map.items() if col_name not in col_names_list)

    def __len__(self):
        return len(self._filtered_col_indexes)

    def __iter__(self):
        return self

    def next(self):
        if self._iteration_count >= len(self._filtered_col_indexes):
            raise StopIteration
        self._iteration_count += 1

        # TODO re-work this to include helper method from JS (re-port from JS)

        col_index = self._filtered_col_indexes[self._iteration_count - 1]
        col_def = self._table_obj._col_defs[col_index]
        col_name = col_def['name']
        col_fk_table = col_def.get('fk_table')
        col_val = self._record[col_index]

        use_val = ColIter(col_fk_table, col_val) if ((col_fk_table is not None) and (col_val is not None)) else col_val

        return (col_name, use_val)


    def get_related(self, table_name, fk_col_name):
        related_table_obj = self._table_obj._related_fk[table_name][fk_col_name]
        row_iter = RowIter(related_table_obj)
        row_iter.where(fk_col_name, self._record_index)
        return row_iter

    # convenience methods

    def get_by_index(self, col_index):
        #TODO implement handling of FKs. re-port from JS
        return self._record[col_index]

    def get_by_name(self, col_name):
        #TODO implement handling of FKs. re-port from JS
        #TODO implement deep lookup of values in FKs
        col_index = self._table_obj._col_name_index_map[col_name]
        return self._record[col_index]

    def as_list(self):
        #TODO reset self._iteration_count?
        row_list = []
        for col_name, val in self:
            if type(val) is self.__class__:
                row_list.append(val.as_list())
            else:
                row_list.append(val)
        return row_list

    def as_dict(self):
        #TODO reset self._iteration_count?
        row_dict = {}
        for col_name, val in self:
            if type(val) is self.__class__:
                row_dict[col_name] = val.as_dict()
            else:
                row_dict[col_name] = val
        return row_dict


class Table(object):
    def __init__(self, name, load_data):
        self.name = name

        if type(load_data) is dict:
            self._col_defs_raw = load_data['columns']
            self._data = load_data.get('data', [])
        else:
            self._col_defs_raw = load_data
            self._data = []

        # {TABLE_NAME: {COL_NAME: table_obj} }
        self._related_fk = {}

        # {COL_NAME: {val:[pks..]}}
        self._indexes = {}

        # {record_hash: record_index}
        self._hash_cache = None

        self._hash_key_col_index = None

    def __len__(self):
        return len(self._data)

    def init(self, table_dict):
        col_name_index_map = {}
        normalized_col_defs = []

        for i, col_def in enumerate(self._col_defs_raw):
            col_def_dict = {}
            if type(col_def) is dict:
                col_name = col_def['name']
                col_def_dict['name'] = col_name
                fk_table_name = col_def.get('fk')
                if fk_table_name is not None:
                    fk_table = table_dict[fk_table_name]
                    col_def_dict['fk_table'] = fk_table
                    fk_table._related_fk.setdefault(self.name, {})[col_name] = self
                #TODO more work on this hash_key stuff. port to JS
                if col_def.get('hash_key', False):
                    self._hash_key_col_index = i
            else:
                col_def_dict['name'] = col_def

            normalized_col_defs.append(col_def_dict)
            col_name_index_map[col_def_dict['name']] = i

        self._col_name_index_map = col_name_index_map
        self._col_defs = normalized_col_defs
        del self._col_defs_raw

    @property
    def schema(self):
        #TODO add hash_key to schema and port to JS
        schema = []
        for col_def in self._col_defs:
            name = col_def['name']
            fk_table = col_def.get('fk_table')
            if fk_table is None:
                schema.append(name)
            else:
                schema.append({'name': name, 'fk': fk_table.name})
        return schema

    def serialize(self):
        return {'columns': self.schema, 'data': self._data}

    def _get_hash(self, raw_record):
        #TODO hash hints here
        #TODO what if hash_key is missing or None?

        if self._hash_key_col_index is not None:
            return raw_record[self._hash_key_col_index]
        else:
            return tuple(raw_record)

    def _build_hash_cache(self):
        self._hash_cache = {self._get_hash(raw_record): record_index for record_index, raw_record in enumerate(self._data)}

    def insert(self, data):
        #TODO invalidate caches
        raw_record = []
        for col_def in self._col_defs:
            col_name = col_def['name']
            val = data.get(col_name)
            fk_table = col_def.get('fk_table')
            if fk_table is None:
                raw_record.append(val)
            elif val is None:
                raw_record.append(None)
            else:
                fk_insert_index = fk_table.insert(val)
                raw_record.append(fk_insert_index)

        raw_record_hash = self._get_hash(raw_record)
        if self._hash_cache is None:
            self._build_hash_cache()
        existing_record_index = self._hash_cache.get(raw_record_hash)
        if existing_record_index is None:
            new_index = len(self)
            self._data.append(raw_record)
            self._hash_cache[raw_record_hash] = existing_record_index = new_index
        return existing_record_index


class DataStore(object):

    #TODO make sure/enforce all table names in a dataset are unique
    def __init__(self, load_data):
        self._table_dict = {}

        for table_name, table_data in load_data.items():
            table = Table(table_name, table_data)
            self._table_dict[table.name] = table

        for table in self._table_dict.values():
            table.init(self._table_dict)

    @property
    def schema(self):
        return {table_name: table_obj.schema for table_name, table_obj in self._table_dict.items()}

    def serialize(self):
        return {table_name: table_obj.serialize() for table_name, table_obj in self._table_dict.items()}

    def select(self, table_name):
        return RowIter(self._table_dict[table_name])

    def get_record(self, table_name, record_index):
        return ColIter(self._table_dict[table_name], record_index)

    #TODO port lookup from js

    def insert(self, table_name, data):
        return self._table_dict[table_name].insert(data)

    def insert_many(self, table_name, data_list):
        table_obj = self._table_dict[table_name]
        for data_dict in data_list:
            table_obj.insert(data_dict)
        #TODO return a list of inserted indexes here? Not sure why we would ever need this...
