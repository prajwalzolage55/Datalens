def basic_eda(df):
    print("basic_eda function loaded")
    return {
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_names": list(df.columns),
        "missing_values": df.isnull().sum().to_dict()
    }
