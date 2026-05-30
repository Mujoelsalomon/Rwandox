import pandas as pd
import numpy as np
from typing import Dict, Any


def preprocess(features: Dict[str, Any]) -> pd.DataFrame:
    """Simple preprocessing pipeline.

    This is a lightweight placeholder:
    - Casts to DataFrame
    - Fills numeric NA with column median
    - Leaves categorical values as-is (user can extend with encoders)
    """
    df = pd.DataFrame([features])

    # Fill numeric missing values with median
    for col in df.select_dtypes(include=[np.number]).columns:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())

    # Ensure column order is deterministic
    df = df.reindex(sorted(df.columns), axis=1)
    return df
