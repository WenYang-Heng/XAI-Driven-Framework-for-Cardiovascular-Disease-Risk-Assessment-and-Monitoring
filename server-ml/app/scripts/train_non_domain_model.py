from app.services.non_domain_model import comparison_table, train_and_compare_non_domain_models


def main() -> None:
    metadata = train_and_compare_non_domain_models()
    print(comparison_table(metadata))


if __name__ == "__main__":
    main()
