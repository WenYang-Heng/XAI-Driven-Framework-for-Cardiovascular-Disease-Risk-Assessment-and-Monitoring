insert into public.ml_models (
    model_name,
    display_name,
    description,
    model_version,
    is_active
)
values
(
    'xgboost',
    'XGBoost',
    'Gradient boosted decision tree classifier using XGBoost.',
    'uci-heart-xgboost',
    true
),
(
    'random_forest',
    'Random Forest',
    'Tree ensemble classifier using scikit-learn RandomForestClassifier.',
    'uci-heart-random_forest',
    true
),
(
    'neural_network',
    'Neural Network Classification',
    'Feed-forward neural network classifier using scikit-learn MLPClassifier.',
    'uci-heart-neural_network',
    true
),
(
    'logistic_regression',
    'Logistic Regression',
    'Linear baseline classifier using scikit-learn LogisticRegression.',
    'uci-heart-logistic_regression',
    true
)
on conflict (model_name) do update set
    display_name = excluded.display_name,
    description = excluded.description,
    model_version = excluded.model_version,
    is_active = excluded.is_active,
    updated_at = now();
