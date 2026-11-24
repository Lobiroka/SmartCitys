from datetime import datetime, timezone

ACQUIRED_AT = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)


def datasets():
    """Respostas SIDRA sintéticas: cabeçalho, nulos, zero e duplicata idêntica."""
    header = {"D1C": "Bairro (Código)", "D1N": "Bairro", "V": "Valor"}
    population = [header, *[
        {"D1C": code, "D1N": name, "V": value, "data_extracao": ACQUIRED_AT}
        for code, name, value in [
            ("001", "Alpha", "100"), ("002", "Beta", "0"),
            ("003", "Gamma", "-"), ("004", "Delta", "50"),
        ]
    ]]
    population.append(dict(population[1]))
    total = [header, *[{"D1C": code, "V": value} for code, value in
                       [("001", "10"), ("002", "0"), ("003", "..."), ("004", "3")]]]
    network = [header, *[{"D1C": code, "V": value} for code, value in
                         [("001", "5"), ("002", "0"), ("003", "-"), ("004", "1")]]]
    return population, {"total": total, "rede_geral": network}
