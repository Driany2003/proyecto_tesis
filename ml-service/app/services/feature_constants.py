ACOUSTIC_FEATURES = [
    "f0_mean",
    "f0_std",
    "f0_min",
    "f0_max",
    "jitter",
    "shimmer",
    "hnr",
    "nhr",
]

NLP_FEATURES = [
    "ttr",
    "words_per_min",
    "avg_word_length",
    "pause_ratio",
    "filler_count",
    "sentence_count",
]

CLINICAL_FEATURES = [
    "age",
    "symptom_onset_months",
]

DEFAULT_FEATURE_ORDER = ACOUSTIC_FEATURES + NLP_FEATURES + CLINICAL_FEATURES
