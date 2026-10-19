"""Genera notif_test_v1/v2/v3.atom. Ejecutar: python _gen_notif_test_atoms.py"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).parent

# id, title_base, amounts, cpv, type_code, deadline, status per version
TENDERS = [
    # v1 → v2 → v3 (misma licitación puede cambiar más de una vez: p. ej. Gamma).
    ("001", "NOTIF Alfa suministro oficina", "11000.00", "9090.91", "30192000", "1", "2026-11-15", ["PUB", "PUB", "PUB"]),
    ("002", "NOTIF Beta servicios limpieza", "22000.00", "18181.82", "90910000", "2", "2026-11-20", ["PRE", "PRE", "ADJ"]),
    ("003", "NOTIF Gamma equipos informaticos", "33000.00", "27272.73", "30200000", "1", "2026-11-25", ["EV", "ADJ", "RES"]),
    ("004", "NOTIF Delta obras mantenimiento", "44000.00", "36363.64", "45210000", "3", "2026-11-30", ["ADJ", "RES", "RES"]),
    ("005", "NOTIF Epsilon consultoria", "55000.00", "45454.55", "79400000", "2", "2026-12-05", ["RES", "RES", "RES"]),
]

STATUS_LABEL = {
    "PUB": "publicada",
    "PRE": "preparada",
    "EV": "evaluacion",
    "ADJ": "adjudicada",
    "RES": "resuelta",
}


def entry(
    *,
    num: str,
    title: str,
    status: str,
    total: str,
    net: str,
    cpv: str,
    type_code: str,
    deadline: str,
    updated: str,
) -> str:
    return f"""  <entry>
    <id>https://contrataciondelsectorpublico.gob.es/wps/fixture?idExpediente=NOTIF-TEST-{num}</id>
    <title>{title}</title>
    <updated>{updated}</updated>
    <link href="https://contrataciondelsectorpublico.gob.es/wps/fixture?idE=NOTIF-TEST-{num}" rel="alternate"/>
    <content type="application/xml">
      <cac-ext:ContractFolderStatus>
        <cbc:ContractFolderID>NOTIF/2026/{num}</cbc:ContractFolderID>
        <cbc-place-ext:ContractFolderStatusCode listURI="https://contrataciondelestado.es/codice/cl/2.04/SyndicationContractFolderStatusCode-2.04.gc">{status}</cbc-place-ext:ContractFolderStatusCode>
        <cac-ext:LocatedContractingParty>
          <cac:Party>
            <cac:PartyIdentification>
              <cbc:ID schemeName="NIF">B11111111</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
              <cbc:Name>Organismo Notif Test S.A.</cbc:Name>
            </cac:PartyName>
          </cac:Party>
        </cac-ext:LocatedContractingParty>
        <cac:ProcurementProject>
          <cbc:Name>{title}</cbc:Name>
          <cbc:TypeCode listURI="http://contrataciondelestado.es/codice/cl/2.08/ContractCode-2.08.gc">{type_code}</cbc:TypeCode>
          <cac:BudgetAmount>
            <cbc:TotalAmount currencyID="EUR">{total}</cbc:TotalAmount>
            <cbc:TaxExclusiveAmount currencyID="EUR">{net}</cbc:TaxExclusiveAmount>
          </cac:BudgetAmount>
          <cac:RequiredCommodityClassification>
            <cbc:ItemClassificationCode listURI="http://contrataciondelestado.es/codice/cl/1.04/CPV2008-1.04.gc">{cpv}</cbc:ItemClassificationCode>
          </cac:RequiredCommodityClassification>
          <cac:RealizedLocation>
            <cbc:CountrySubentityCode listURI="http://publications.europa.eu/resource/authority/nuts">ES300</cbc:CountrySubentityCode>
          </cac:RealizedLocation>
        </cac:ProcurementProject>
        <cac:TenderingProcess>
          <cbc:ProcedureCode listURI="http://contrataciondelestado.es/codice/cl/2.07/SyndicationTenderingProcessCode-2.07.gc">1</cbc:ProcedureCode>
          <cac:TenderSubmissionDeadlinePeriod>
            <cbc:EndDate>{deadline}</cbc:EndDate>
            <cbc:EndTime>14:00:00</cbc:EndTime>
          </cac:TenderSubmissionDeadlinePeriod>
        </cac:TenderingProcess>
      </cac-ext:ContractFolderStatus>
    </content>
  </entry>"""


def feed(version: int) -> str:
    feed_updated = f"2026-10-19T1{version}:00:00+02:00"
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f"""<!-- Fixture notificaciones in-app — pasada {version}. Buscar: NOTIF -->
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:cbc="urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2"
      xmlns:cac="urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2"
      xmlns:cac-ext="urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2"
      xmlns:cbc-place-ext="urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2">
  <id>https://example.invalid/sindicacion/notif-test-v{version}</id>
  <title>PLACSP notif test feed — v{version}</title>
  <updated>{feed_updated}</updated>
""",
    ]
    for i, (num, base, total, net, cpv, type_code, deadline, statuses) in enumerate(
        TENDERS, start=1
    ):
        status = statuses[version - 1]
        title = f"{base} ({STATUS_LABEL[status]})"
        updated = f"2026-10-19T1{version}:00:0{i}+02:00"
        parts.append(
            entry(
                num=num,
                title=title,
                status=status,
                total=total,
                net=net,
                cpv=cpv,
                type_code=type_code,
                deadline=deadline,
                updated=updated,
            )
        )
    parts.append("</feed>\n")
    return "\n".join(parts)


def main() -> None:
    for v in (1, 2, 3):
        path = OUT / f"notif_test_v{v}.atom"
        path.write_text(feed(v), encoding="utf-8")
        print(f"wrote {path.name}")


if __name__ == "__main__":
    main()
