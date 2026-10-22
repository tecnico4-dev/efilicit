#!/usr/bin/env python3
"""Genera SQL de demo: vacía dominio (salvo users + geo) e inserta ~50 licitaciones ES.

Uso:
  python scripts/seed_demo_remote.py > /tmp/demo_seed.sql
  npx supabase db query --linked -f /tmp/demo_seed.sql

No toca auth.users, public.users, geo_ccaa ni geo_municipio.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from textwrap import dedent


def q(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def q_ts(dt: datetime | None) -> str:
    if dt is None:
        return "null"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return q(dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00"))


def q_date(d: date | None) -> str:
    if d is None:
        return "null"
    return q(d.isoformat())


def uuid(n: int, prefix: str = "a") -> str:
    return f"{prefix}0000000-0000-4000-8000-{n:012d}"


@dataclass
class Authority:
    id: str
    name: str
    tax_id: str | None
    municipality: str | None
    country: str = "ES"
    platform_id: str | None = None


@dataclass
class Tender:
    id: str
    title: str
    description: str | None
    status: str | None
    procedure_type: str | None
    contract_type: str | None
    estimated_value: float | None
    publication_date: date | None
    deadline_at: datetime | None
    authority_id: str
    source_code: str
    source_tender_id: str
    place_ccaa: str | None = None
    place_muni: str | None = None
    cpvs: list[str] = field(default_factory=list)
    extra_sources: list[tuple[str, str]] = field(default_factory=list)
    status_history: list[tuple[date, str]] = field(default_factory=list)


def build_authorities() -> list[Authority]:
    return [
        Authority(uuid(1, "b"), "Ayuntamiento de Madrid", "P2807900B", "Madrid"),
        Authority(uuid(2, "b"), "Ajuntament de Barcelona", "P0801900B", "Barcelona"),
        Authority(uuid(3, "b"), "Junta de Andalucía", "S4111001F", "Sevilla"),
        Authority(uuid(4, "b"), "Generalitat de Catalunya", "S0811001G", "Barcelona", platform_id="A09000001"),
        Authority(uuid(5, "b"), "Gobierno Vasco / Eusko Jaurlaritza", "S4800001C", "Vitoria-Gasteiz"),
        Authority(uuid(6, "b"), "Ayuntamiento de Valencia", "P4625000A", "Valencia"),
        Authority(uuid(7, "b"), "Diputación de Zaragoza", "P5000000H", "Zaragoza"),
        Authority(uuid(8, "b"), "Ayuntamiento de Murcia", "P3003000A", "Murcia"),
        Authority(uuid(9, "b"), "Concello da Coruña", "P1503000A", "A Coruña"),
        Authority(uuid(10, "b"), "Ayuntamiento de Bilbao", "P4802000F", "Bilbao"),
    ]


def build_tenders(authorities: list[Authority]) -> list[Tender]:
    today = date(2026, 10, 22)
    now = datetime(2026, 10, 22, 10, 0, tzinfo=timezone.utc)
    a = {i + 1: authorities[i] for i in range(len(authorities))}

    specs: list[Tender] = []

    # Plantillas variadas (títulos ES, fuentes mixtas).
    raw: list[dict] = [
        # software / servicios + multi CPV + Madrid
        dict(
            title="Mantenimiento de software de gestión municipal",
            desc="Soporte y evolución de aplicaciones de administración electrónica.",
            status="publicada",
            procedure="abierto",
            contract="servicios",
            value=125000,
            pub=today - timedelta(days=5),
            deadline=now + timedelta(days=20),
            auth=1,
            src=("placsp", "DEMO-SOFT-001"),
            ccaa="13",
            muni="28079",
            cpvs=["72000000", "72260000"],
            history=[(today - timedelta(days=5), "publicada")],
        ),
        dict(
            title="Suministro de material de oficina para centros escolares",
            desc="Papelería, toner y consumibles para el curso escolar.",
            status="publicada",
            procedure="abierto_simplificado",
            contract="suministros",
            value=45000,
            pub=today - timedelta(days=12),
            deadline=now + timedelta(days=8),
            auth=2,
            src=("catalunya", "DEMO-CAT-OFIC-02"),
            ccaa="09",
            muni="08019",
            cpvs=["30190000"],
        ),
        dict(
            title="Obras de reforma de edificio administrativo",
            desc="Rehabilitación de fachada y accesibilidad en sede municipal.",
            status="evaluacion",
            procedure="abierto",
            contract="obras",
            value=890000,
            pub=today - timedelta(days=40),
            deadline=now - timedelta(days=5),
            auth=1,
            src=("placsp_agregadas", "DEMO-OBRAS-03"),
            ccaa="13",
            muni="28079",
            cpvs=["45210000", "45453000"],
            history=[
                (today - timedelta(days=40), "publicada"),
                (today - timedelta(days=10), "evaluacion"),
            ],
            extra=[("placsp", "DEMO-OBRAS-03-PL")],
        ),
        dict(
            title="Servicio de alumbrado público LED en distritos norte",
            desc="Sustitución de luminarias y mantenimiento preventivo.",
            status="publicada",
            procedure="abierto",
            contract="servicios",
            value=310000,
            pub=today - timedelta(days=3),
            deadline=now + timedelta(days=25),
            auth=3,
            src=("placsp", "DEMO-ALU-04"),
            ccaa="01",
            muni="41091",
            cpvs=["50232100", "31500000"],
        ),
        dict(
            title="Limpieza de edificios públicos y centros cívicos",
            desc="Servicio integral de limpieza con criterios ambientales.",
            status="adjudicada",
            procedure="abierto",
            contract="servicios",
            value=560000,
            pub=today - timedelta(days=90),
            deadline=now - timedelta(days=60),
            auth=6,
            src=("placsp_agregadas", "DEMO-LIM-05"),
            ccaa="10",
            muni="46250",
            cpvs=["90910000"],
            history=[
                (today - timedelta(days=90), "publicada"),
                (today - timedelta(days=50), "evaluacion"),
                (today - timedelta(days=20), "adjudicada"),
            ],
        ),
        # solo CCAA, sin municipio
        dict(
            title="Asistencia técnica en ciberseguridad para la Administración",
            desc="Auditorías, SOC y formación del personal.",
            status="publicada",
            procedure="restringido",
            contract="servicios",
            value=220000,
            pub=today - timedelta(days=7),
            deadline=now + timedelta(days=14),
            auth=4,
            src=("catalunya", "DEMO-CAT-CYBER-06"),
            ccaa="09",
            muni=None,
            cpvs=["72000000", "72600000", "72810000"],
        ),
        # sin geo
        dict(
            title="Suministro de equipos informáticos portátiles",
            desc="Laptops y periféricos para teletrabajo seguro.",
            status="publicada",
            procedure="contrato_menor",
            contract="suministros",
            value=18000,
            pub=today - timedelta(days=2),
            deadline=now + timedelta(days=5),
            auth=5,
            src=("euskadi", "DEMO-EUS-PC-07"),
            ccaa=None,
            muni=None,
            cpvs=["30213000"],
        ),
        dict(
            title="Concesión de cafetería en edificio institucional",
            desc="Explotación de servicio de restauración.",
            status="publicada",
            procedure="abierto",
            contract="concesion_servicios",
            value=None,
            pub=today - timedelta(days=15),
            deadline=now + timedelta(days=30),
            auth=7,
            src=("placsp", "DEMO-CAF-08"),
            ccaa="02",
            muni="50297",
            cpvs=["55300000"],
        ),
        dict(
            title="Obras de asfaltado y señalización viaria",
            desc="Renovación de calzada en vías urbanas prioritarias.",
            status="publicada",
            procedure="abierto",
            contract="obras",
            value=1450000,
            pub=today - timedelta(days=9),
            deadline=now + timedelta(days=18),
            auth=8,
            src=("placsp_menores", "DEMO-MEN-ASF-09"),
            ccaa="14",
            muni="30030",
            cpvs=["45233140"],
        ),
        dict(
            title="Servicio de transporte escolar adaptado",
            desc="Rutas escolares con vehículos accesibles.",
            status="desierta",
            procedure="abierto",
            contract="servicios",
            value=98000,
            pub=today - timedelta(days=120),
            deadline=now - timedelta(days=80),
            auth=9,
            src=("placsp_agregadas", "DEMO-TRANS-10"),
            ccaa="12",
            muni="15030",
            cpvs=["60100000"],
            history=[
                (today - timedelta(days=120), "publicada"),
                (today - timedelta(days=70), "desierta"),
            ],
        ),
        dict(
            title="Mantenimiento de zonas verdes y parques urbanos",
            desc="Jardinería, poda y riego inteligente.",
            status="publicada",
            procedure="abierto_simplificado",
            contract="servicios",
            value=275000,
            pub=today - timedelta(days=4),
            deadline=now + timedelta(days=22),
            auth=10,
            src=("euskadi", "DEMO-EUS-PARK-11"),
            ccaa="16",
            muni="48020",
            cpvs=["77310000"],
        ),
        dict(
            title="Suministro de material de laboratorio clínico",
            desc="Reactivos y fungibles para laboratorio municipal.",
            status="preparada",
            procedure="negociado_con_publicidad",
            contract="suministros",
            value=67000,
            pub=today - timedelta(days=1),
            deadline=now + timedelta(days=40),
            auth=2,
            src=("catalunya", "DEMO-CAT-LAB-12"),
            ccaa="09",
            muni="08019",
            cpvs=["33696000", "38430000"],
        ),
        dict(
            title="Desarrollo de portal de datos abiertos",
            desc="Diseño, implantación y formación en open data.",
            status="publicada",
            procedure="abierto",
            contract="servicios",
            value=95000,
            pub=today - timedelta(days=6),
            deadline=now + timedelta(days=16),
            auth=4,
            src=("catalunya", "DEMO-CAT-DATA-13"),
            ccaa="09",
            muni=None,
            cpvs=["72000000", "72400000"],
            extra=[("placsp", "DEMO-DATA-13-PL")],
        ),
        dict(
            title="Anulación de contrato de vigilancia (expediente demo)",
            desc="Expediente anulado por cambio de necesidades.",
            status="anulada",
            procedure="abierto",
            contract="servicios",
            value=210000,
            pub=today - timedelta(days=200),
            deadline=now - timedelta(days=150),
            auth=1,
            src=("placsp", "DEMO-ANUL-14"),
            ccaa="13",
            muni=None,
            cpvs=["79710000"],
            history=[
                (today - timedelta(days=200), "publicada"),
                (today - timedelta(days=160), "anulada"),
            ],
        ),
        # sin CPV
        dict(
            title="Asesoramiento jurídico en contratación pública",
            desc="Apoyo externo en pliegos y recursos.",
            status="publicada",
            procedure="negociado_sin_publicidad",
            contract="servicios",
            value=32000,
            pub=today - timedelta(days=8),
            deadline=now + timedelta(days=11),
            auth=3,
            src=("placsp", "DEMO-JUR-15"),
            ccaa="01",
            muni=None,
            cpvs=[],
        ),
        dict(
            title="Suministro de vehículos eléctricos para flota municipal",
            desc="Turismos y furgonetas cero emisiones.",
            status="publicada",
            procedure="abierto",
            contract="suministros",
            value=780000,
            pub=today - timedelta(days=11),
            deadline=now + timedelta(days=28),
            auth=5,
            src=("euskadi", "DEMO-EUS-EV-16"),
            ccaa="16",
            muni="48020",
            cpvs=["34144900", "34110000"],
        ),
        dict(
            title="Obras de mejora de eficiencia energética en colegios",
            desc="Aislamiento, calderas y monitorización.",
            status="evaluacion",
            procedure="abierto",
            contract="obras",
            value=2100000,
            pub=today - timedelta(days=55),
            deadline=now - timedelta(days=15),
            auth=6,
            src=("placsp_agregadas", "DEMO-ENE-17"),
            ccaa="10",
            muni=None,
            cpvs=["45321000", "45214200"],
            history=[
                (today - timedelta(days=55), "publicada"),
                (today - timedelta(days=15), "evaluacion"),
            ],
        ),
        dict(
            title="Servicio de comedor escolar y dieta mediterránea",
            desc="Menús equilibrados y productos de proximidad.",
            status="publicada",
            procedure="abierto",
            contract="servicios",
            value=430000,
            pub=today - timedelta(days=14),
            deadline=now + timedelta(days=9),
            auth=9,
            src=("placsp_menores", "DEMO-MEN-COM-18"),
            ccaa="12",
            muni="15030",
            cpvs=["55520000"],
        ),
        dict(
            title="Digitalización de archivos históricos municipales",
            desc="Escaneado, indexación y custodia segura.",
            status="resuelta",
            procedure="abierto_simplificado",
            contract="servicios",
            value=54000,
            pub=today - timedelta(days=180),
            deadline=now - timedelta(days=140),
            auth=7,
            src=("placsp", "DEMO-DIG-19"),
            ccaa="02",
            muni="50297",
            cpvs=["72310000", "92512000"],
            history=[
                (today - timedelta(days=180), "publicada"),
                (today - timedelta(days=150), "evaluacion"),
                (today - timedelta(days=130), "adjudicada"),
                (today - timedelta(days=100), "resuelta"),
            ],
        ),
        dict(
            title="Mantenimiento de red de fibra óptica municipal",
            desc="Operación y supervisión de red FTTH corporativa.",
            status="publicada",
            procedure="derivado_acuerdo_marco",
            contract="servicios",
            value=160000,
            pub=today - timedelta(days=3),
            deadline=now + timedelta(days=12),
            auth=10,
            src=("euskadi", "DEMO-EUS-FIBRA-20"),
            ccaa="16",
            muni=None,
            cpvs=["50330000", "32412000"],
        ),
    ]

    # Ampliar hasta ~50 con variaciones sistemáticas.
    themes = [
        ("Suministro de mobiliario escolar ergonómico", "suministros", "30120000", "abierto"),
        ("Servicio de traducción e interpretación", "servicios", "79530000", "abierto_simplificado"),
        ("Obras de reparación de cubierta en polideportivo", "obras", "45261900", "abierto"),
        ("Alquiler de equipos de proyección y sonido", "suministros", "32321200", "contrato_menor"),
        ("Servicio de vigilancia con videovigilancia", "servicios", "79711000", "abierto"),
        ("Suministro de EPI para personal de obras", "suministros", "18143000", "abierto_simplificado"),
        ("Consultoría en igualdad y diversidad", "servicios", "79400000", "negociado_con_publicidad"),
        ("Obras de ampliación de biblioteca pública", "obras", "45212312", "abierto"),
        ("Servicio de cloud hosting soberano", "servicios", "72415000", "abierto"),
        ("Suministro de software ofimático con licencias", "suministros", "48000000", "abierto"),
        ("Mantenimiento de ascensores en edificios públicos", "servicios", "50750000", "abierto"),
        ("Obras de adecuación de pasos peatonales", "obras", "45233220", "abierto_simplificado"),
        ("Servicio de recogida selectiva de residuos", "servicios", "90511000", "abierto"),
        ("Suministro de material deportivo escolar", "suministros", "37410000", "contrato_menor"),
        ("Auditoría energética de farolas municipales", "servicios", "71314000", "restringido"),
        ("Reforma de salas de espera en centros de salud", "obras", "45215140", "abierto"),
        ("Plataforma de cita previa ciudadana", "servicios", "72212000", "abierto"),
        ("Suministro de banqueta urbana y papeleras", "suministros", "34928400", "abierto_simplificado"),
        ("Servicio de desinsectación y desratización", "servicios", "90920000", "negociado_sin_publicidad"),
        ("Obras de mejora de accesibilidad en plazas", "obras", "45233290", "abierto"),
        ("Formación en competencias digitales", "servicios", "80500000", "abierto"),
        ("Suministro de servidores y almacenamiento", "suministros", "30233000", "abierto"),
        ("Mantenimiento de sistemas de climatización", "servicios", "50730000", "abierto_simplificado"),
        ("Concesión de aparcamiento rotatorio", "concesion_servicios", "98351000", "abierto"),
        ("Suministro de reactivos para control de aguas", "suministros", "24962000", "abierto"),
        ("Servicio de diseño de campaña de prevención", "servicios", "79340000", "abierto_simplificado"),
        ("Obras de canalización de pluviales", "obras", "45232450", "abierto"),
        ("Soporte de helpdesk de informática", "servicios", "72253000", "abierto"),
        ("Suministro de papelería reciclada", "suministros", "30197630", "contrato_menor"),
        ("Servicio de mediación vecinal", "servicios", "75200000", "negociado_con_publicidad"),
    ]

    places = [
        ("13", "28079", 1, "placsp"),
        ("09", "08019", 2, "catalunya"),
        ("01", "41091", 3, "placsp_agregadas"),
        ("09", None, 4, "catalunya"),
        ("16", "48020", 5, "euskadi"),
        ("10", "46250", 6, "placsp"),
        ("02", None, 7, "placsp_menores"),
        ("14", "30030", 8, "placsp_agregadas"),
        ("12", None, 9, "placsp"),
        ("16", None, 10, "euskadi"),
        (None, None, 1, "placsp"),
        ("13", None, 1, "placsp_agregadas"),
        ("01", None, 3, "placsp"),
        ("10", None, 6, "placsp_menores"),
        ("02", "50297", 7, "placsp"),
    ]

    statuses_cycle = [
        "publicada",
        "publicada",
        "evaluacion",
        "adjudicada",
        "publicada",
        None,
    ]

    for i, (title, contract, cpv, procedure) in enumerate(themes):
        n = 21 + i
        ccaa, muni, auth_i, source = places[i % len(places)]
        st = statuses_cycle[i % len(statuses_cycle)]
        multi = i % 5 == 0
        cpvs = [cpv, "72000000"] if multi and cpv != "72000000" else ([cpv] if cpv else [])
        pub = today - timedelta(days=2 + i)
        deadline = now + timedelta(days=3 + (i % 25)) if st in (None, "publicada", "preparada") else now - timedelta(days=10 + i)
        history = []
        if st and st != "publicada":
            history = [(pub, "publicada"), (pub + timedelta(days=15), st)]
        elif st == "publicada":
            history = [(pub, "publicada")]
        raw.append(
            dict(
                title=title,
                desc=f"Expediente de demostración ({n}): {title.lower()}.",
                status=st,
                procedure=procedure,
                contract=contract,
                value=15000 + i * 12345,
                pub=pub,
                deadline=deadline,
                auth=auth_i,
                src=(source, f"DEMO-VAR-{n:03d}"),
                ccaa=ccaa,
                muni=muni,
                cpvs=cpvs,
                history=history,
                extra=[("placsp", f"DEMO-VAR-{n:03d}-SEC")] if i % 7 == 0 else [],
            )
        )

    for i, row in enumerate(raw, start=1):
        src_code, src_id = row["src"]
        specs.append(
            Tender(
                id=uuid(i, "a"),
                title=row["title"],
                description=row.get("desc"),
                status=row.get("status"),
                procedure_type=row.get("procedure"),
                contract_type=row.get("contract"),
                estimated_value=row.get("value"),
                publication_date=row.get("pub"),
                deadline_at=row.get("deadline"),
                authority_id=a[row["auth"]].id,
                source_code=src_code,
                source_tender_id=src_id,
                place_ccaa=row.get("ccaa"),
                place_muni=row.get("muni"),
                cpvs=list(row.get("cpvs") or []),
                extra_sources=list(row.get("extra") or []),
                status_history=list(row.get("history") or []),
            )
        )
    return specs


def render_sql() -> str:
    authorities = build_authorities()
    tenders = build_tenders(authorities)
    lines: list[str] = [
        dedent(
            """\
            -- Demo seed remoto EfiLicit (datos sintéticos ES).
            -- Conserva: auth.users, public.users, geo_ccaa, geo_municipio.
            begin;

            truncate table
              public.notification_reads,
              public.notification_queue,
              public.favorites,
              public.alerts,
              public.saved_searches,
              public.tender_cpvs,
              public.tender_events,
              public.tender_sources,
              public.documents,
              public.tenders,
              public.contracting_authorities,
              public.suppliers,
              public.source_artifacts,
              public.source_sync,
              public.errors,
              public.setup_rls_smoke
            restart identity cascade;
            """
        )
    ]

    for auth in authorities:
        lines.append(
            dedent(
                f"""\
                insert into public.contracting_authorities (
                  id, name, name_normalized, tax_id, municipality, country, platform_id
                ) values (
                  {q(auth.id)},
                  {q(auth.name)},
                  {q(auth.name.casefold())},
                  {q(auth.tax_id)},
                  {q(auth.municipality)},
                  {q(auth.country)},
                  {q(auth.platform_id)}
                );
                """
            )
        )

    for t in tenders:
        value_sql = "null" if t.estimated_value is None else str(round(t.estimated_value, 2))
        lines.append(
            dedent(
                f"""\
                insert into public.tenders (
                  id, title, description, status, procedure_type, contract_type,
                  estimated_value, currency, publication_date, deadline_at,
                  contracting_authority_id, canonical_source_code,
                  place_ccaa_code, place_municipality_code,
                  created_at, updated_at
                ) values (
                  {q(t.id)},
                  {q(t.title)},
                  {q(t.description)},
                  {q(t.status)},
                  {q(t.procedure_type)},
                  {q(t.contract_type)},
                  {value_sql},
                  'EUR',
                  {q_date(t.publication_date)},
                  {q_ts(t.deadline_at)},
                  {q(t.authority_id)},
                  {q(t.source_code)},
                  {q(t.place_ccaa)},
                  {q(t.place_muni)},
                  now(),
                  now()
                );
                """
            )
        )
        lines.append(
            dedent(
                f"""\
                insert into public.tender_sources (
                  tender_id, source_code, source_tender_id, match_method, review_status, last_seen_at
                ) values (
                  {q(t.id)}, {q(t.source_code)}, {q(t.source_tender_id)},
                  'auto', 'auto', now()
                );
                """
            )
        )
        for extra_code, extra_id in t.extra_sources:
            lines.append(
                dedent(
                    f"""\
                    insert into public.tender_sources (
                      tender_id, source_code, source_tender_id, match_method, review_status, last_seen_at
                    ) values (
                      {q(t.id)}, {q(extra_code)}, {q(extra_id)},
                      'auto', 'auto', now()
                    );
                    """
                )
            )
        for cpv in t.cpvs:
            lines.append(
                f"insert into public.tender_cpvs (tender_id, cpv_code) values ({q(t.id)}, {q(cpv)});\n"
            )
        if t.status_history:
            first = True
            for d, status in t.status_history:
                etype = "ingerida" if first else "actualizada"
                first = False
                occurred = datetime(d.year, d.month, d.day, 12, 0, tzinfo=timezone.utc)
                lines.append(
                    dedent(
                        f"""\
                        insert into public.tender_events (
                          tender_id, event_type, event_status, occurred_at, source_code, created_at
                        ) values (
                          {q(t.id)}, {q(etype)}, {q(status)},
                          {q_ts(occurred)}, {q(t.source_code)}, {q_ts(occurred)}
                        );
                        """
                    )
                )
        elif t.status:
            pub = t.publication_date or date(2026, 10, 1)
            occurred = datetime(pub.year, pub.month, pub.day, 12, 0, tzinfo=timezone.utc)
            lines.append(
                dedent(
                    f"""\
                    insert into public.tender_events (
                      tender_id, event_type, event_status, occurred_at, source_code, created_at
                    ) values (
                      {q(t.id)}, 'ingerida', {q(t.status)},
                      {q_ts(occurred)}, {q(t.source_code)}, {q_ts(occurred)}
                    );
                    """
                )
            )

    lines.append(
        dedent(
            f"""\
            -- control
            -- authorities={len(authorities)} tenders={len(tenders)}
            commit;
            """
        )
    )
    return "\n".join(lines)


def main() -> None:
    print(render_sql())


if __name__ == "__main__":
    main()
