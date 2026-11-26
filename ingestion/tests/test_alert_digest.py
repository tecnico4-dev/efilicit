"""Semana 5 Paso 8: digest diario/semanal + Resend (FakeEmailSender sin red)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.digest import (
    UserEmailDirectory,
    build_digest_message,
    drain_daily_digests,
)
from efilicit_ingestion.alerts.email import FakeEmailSender
from efilicit_ingestion.alerts.inbox import InMemoryDigestInbox
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate
from efilicit_ingestion.alerts.queue import (
    InMemoryNotificationQueue,
    digest_period,
    make_idempotency_key,
    should_send_digest,
)

# 2026-09-28 = lunes UTC; 2026-09-29 = martes UTC (misma semana ISO).
MONDAY = date(2026, 9, 28)
TUESDAY = date(2026, 9, 29)


def _tender(tid: str, title: str) -> TenderCandidate:
    return TenderCandidate(
        id=tid,
        title=title,
        description=title,
        status="publicada",
        contract_type="servicios",
        estimated_value=Decimal("50000"),
        cpv_codes=("72000000",),
        publication_date=date(2026, 9, 1),
        municipality="Madrid",
        country="ES",
    )


def _enqueue_software_match(
    queue: InMemoryNotificationQueue,
    *,
    digest: str = "2026-09-30",
    frequencies: dict[str, str] | None = None,
    job_date: date | None = None,
) -> None:
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    run_alert_batch(
        alerts=[alert],
        tenders=[
            _tender("t-soft", "Mantenimiento de software"),
            _tender("t-soft-2", "Software de gestión"),
        ],
        queue=queue,
        digest=job_date or digest,
        frequencies=frequencies,
    )


def test_digest_period_daily_and_weekly_iso() -> None:
    assert digest_period("diaria", TUESDAY) == "2026-09-29"
    assert digest_period("semanal", MONDAY) == digest_period("semanal", TUESDAY)
    assert digest_period("semanal", TUESDAY).startswith("2026-W")
    assert should_send_digest("diaria", TUESDAY) is True
    assert should_send_digest("semanal", TUESDAY) is False
    assert should_send_digest("semanal", MONDAY) is True


def test_build_digest_message_groups_titles() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    pending = queue.pending_items()
    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-09-30",
        items=pending,
        display_name="Alice",
        base_url="https://app.example.com",
        source_urls={
            "t-soft": "https://contratacion.example/soft",
            "t-soft-2": "https://contratacion.example/soft-2",
        },
    )
    assert "alice@example.com" == msg.to
    assert msg.subject == "EfiLicit resumen diario: 2 oportunidades nuevas"
    assert "Hola, Alice" in msg.text
    assert "Tienes 2 nuevas coincidencias en 1 alerta." in msg.text
    assert "## Software" in msg.text
    assert "Mantenimiento de software" in msg.text
    assert "Software de gestión" in msg.text
    assert "50.000 €" not in msg.text
    assert (
        "Ver en EfiLicit: https://app.example.com/tenders/t-soft?from=email"
        in msg.text
    )
    assert "Fuente oficial: https://contratacion.example/soft" in msg.text
    assert "#52b9d8" in (msg.html or "")
    assert "Hola, Alice" in (msg.html or "")
    assert "Resumen diario" in (msg.html or "")
    assert "Software" in (msg.html or "")
    assert "Ver en EfiLicit" in (msg.html or "")
    assert "Fuente oficial" in (msg.html or "")
    assert "https://contratacion.example/soft" in (msg.html or "")
    assert ">Efi</span>" in (msg.html or "")
    assert ">Licit</span>" in (msg.html or "")


def test_build_digest_message_blocks_by_alert_and_caps_at_five() -> None:
    queue = InMemoryNotificationQueue()
    soft = AlertRule(
        id="alert-soft",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    obra = AlertRule(
        id="alert-obra",
        user_id="user-1",
        name="Obras",
        criteria={"version": 1, "keywords": ["obra"]},
    )
    soft_tenders = [
        _tender(f"t-soft-{i}", f"Software {i}") for i in range(1, 8)
    ]
    obra_tenders = [
        _tender("t-obra-1", "Obra vial"),
        _tender("t-obra-2", "Obra hidráulica"),
    ]
    run_alert_batch(
        alerts=[soft, obra],
        tenders=[*soft_tenders, *obra_tenders],
        queue=queue,
        digest="2026-09-30",
    )
    pending = queue.pending_items()
    assert len(pending) == 9

    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-09-30",
        items=pending,
        display_name="Alice",
        alert_names={"alert-soft": "Software", "alert-obra": "Obras"},
    )
    assert msg.subject == "EfiLicit resumen diario: 9 oportunidades nuevas"
    assert "Tienes 9 nuevas coincidencias en 2 alertas." in msg.text
    assert "## Software" in msg.text
    assert "## Obras" in msg.text
    assert "Software 1" in msg.text
    assert "Software 5" in msg.text
    assert "Software 6" not in msg.text
    assert "… y 2 más en esta alerta." in msg.text
    assert "Obra vial" in msg.text
    assert "Obra hidráulica" in msg.text
    assert "y 2 más en esta alerta" in (msg.html or "")
    # Payload del match incluye alert_name para fallback sin lookup DB.
    assert pending[0].payload.get("alert_name") in {"Software", "Obras"}


def test_build_digest_message_sorts_by_kind_and_shows_bubble() -> None:
    queue = InMemoryNotificationQueue()
    sub = AlertRule(
        id="alert-sub",
        user_id="user-1",
        name="Subcontratas IT",
        criteria={"version": 1, "keywords": ["sub"]},
    )
    efi = AlertRule(
        id="alert-efi",
        user_id="user-1",
        name="Eficen software",
        criteria={"version": 1, "keywords": ["eficen"]},
    )
    bare = AlertRule(
        id="alert-bare",
        user_id="user-1",
        name="Sin clasificar",
        criteria={"version": 1, "keywords": ["bare"]},
    )
    run_alert_batch(
        alerts=[sub, efi, bare],
        tenders=[
            _tender("t-sub", "Contrato sub"),
            _tender("t-efi", "Contrato eficen"),
            _tender("t-bare", "Contrato bare"),
        ],
        queue=queue,
        digest="2026-09-30",
    )
    pending = queue.pending_items()
    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-09-30",
        items=pending,
        display_name="Alice",
        base_url="https://app.example.com",
        alert_names={
            "alert-sub": "Subcontratas IT",
            "alert-efi": "Eficen software",
            "alert-bare": "Sin clasificar",
        },
        alert_kinds={
            "alert-sub": "subcontrata",
            "alert-efi": "propia",
            "alert-bare": None,
        },
    )
    text = msg.text
    efi_pos = text.index("## Eficen software (Eficen)")
    sub_pos = text.index("## Subcontratas IT (Subcontrata)")
    bare_pos = text.index("## Sin clasificar\n")
    assert efi_pos < sub_pos < bare_pos
    assert "(Eficen)" not in text[bare_pos : bare_pos + 40]
    html = msg.html or ""
    assert "Eficen</span>" in html
    assert "Subcontrata</span>" in html
    assert "interest=propia" in html
    assert "interest=subcontrata" in html
    # Sin kind: enlace sin interest.
    assert "t-bare?from=email&interest=" not in html
    assert "tenders/t-bare?from=email\"" in html or "tenders/t-bare?from=email'" in html


def test_build_digest_message_caps_alert_blocks() -> None:
    queue = InMemoryNotificationQueue()
    alerts = [
        AlertRule(
            id=f"alert-{i}",
            user_id="user-1",
            name=f"Alerta {i}",
            criteria={"version": 1, "keywords": [f"kw{i}"]},
        )
        for i in range(1, 8)
    ]
    tenders = [_tender(f"t-{i}", f"Titulo kw{i}") for i in range(1, 8)]
    run_alert_batch(
        alerts=alerts,
        tenders=tenders,
        queue=queue,
        digest="2026-09-30",
    )
    pending = queue.pending_items()
    assert len(pending) == 7

    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-09-30",
        items=pending,
        display_name="Alice",
        alert_names={f"alert-{i}": f"Alerta {i}" for i in range(1, 8)},
    )
    assert "Tienes 7 nuevas coincidencias en 7 alertas." in msg.text
    assert "## Alerta 1" in msg.text
    assert "## Alerta 5" in msg.text
    assert "## Alerta 6" not in msg.text
    assert "## Alerta 7" not in msg.text
    assert "… y 2 alertas más en el buzón." in msg.text
    assert "2 alertas más en el buzón" in (msg.html or "")
    # Spacer entre bloques (no margin): clientes de email respetan height en <td>.
    assert 'height="28"' in (msg.html or "")
    # Asunto y cola: totales reales (solo se recorta la plantilla).
    assert msg.subject == "EfiLicit resumen diario: 7 oportunidades nuevas"


def test_build_digest_message_weekly_singular() -> None:
    queue = InMemoryNotificationQueue()
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    run_alert_batch(
        alerts=[alert],
        tenders=[_tender("t-soft", "Mantenimiento de software")],
        queue=queue,
        digest="2026-09-30",
        frequencies={"user-1": "semanal"},
    )
    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-W40",
        items=queue.pending_items(),
        frequency="semanal",
        display_name="Alice",
    )
    assert msg.subject == "EfiLicit resumen semanal: 1 oportunidad nueva"
    assert "Resumen semanal" in (msg.html or "")


def test_drain_sends_one_digest_and_marks_sent() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    result = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert result.digests_sent == 1
    assert result.items_marked_sent == 2
    assert len(sender.sent) == 1
    assert sender.sent[0].to == "alice@example.com"
    assert all(i.status == "sent" for i in queue.all_items())


def test_drain_records_inbox_aviso_one_per_email() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})
    inbox = InMemoryDigestInbox()
    job_day = date(2026, 9, 30)

    result = drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        inbox=inbox,
        job_date=job_day,
    )
    assert result.digests_sent == 1
    assert len(inbox.entries) == 1
    entry = inbox.entries[0]
    assert entry.user_id == "user-1"
    assert entry.frequency == "diaria"
    assert entry.digest_period == "2026-09-30"
    assert set(entry.tender_ids) == {"t-soft", "t-soft-2"}

    # Segundo drain no reenvía ni duplica el aviso.
    drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        inbox=inbox,
        job_date=job_day,
    )
    assert len(inbox.entries) == 1


def test_drain_one_email_for_several_pending_items() -> None:
    """Varias filas pending del mismo usuario → 1 correo."""
    from efilicit_ingestion.alerts.models import NotificationItem
    from efilicit_ingestion.alerts.queue import make_idempotency_key

    queue = InMemoryNotificationQueue()
    for tid in ("t-a", "t-b", "t-c"):
        key = make_idempotency_key(alert_id="alert-1", tender_id=tid)
        queue.enqueue(
            NotificationItem(
                user_id="user-1",
                alert_id="alert-1",
                idempotency_key=key,
                payload={
                    "tender_id": tid,
                    "alert_id": "alert-1",
                    "alert_name": "Software",
                    "title": f"Titulo {tid}",
                    "frequency": "diaria",
                    "channel": "email",
                    "kind": "alert_match",
                },
            )
        )
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    result = drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        frequencies={"user-1": "diaria"},
        job_date=date(2026, 11, 10),
    )
    assert result.digests_sent == 1
    assert result.items_marked_sent == 3
    assert len(sender.sent) == 1
    assert "3 oportunidades" in sender.sent[0].subject
    assert all(i.status == "sent" for i in queue.all_items())


def test_drain_twice_does_not_resend() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    first = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    second = drain_daily_digests(queue=queue, sender=sender, directory=directory)

    assert first.digests_sent == 1
    assert second.digests_attempted == 0
    assert second.digests_sent == 0
    assert len(sender.sent) == 1

    # Re-batch same day: enqueue idempotent; still no new pending → no resend
    _enqueue_software_match(queue)
    third = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert third.digests_sent == 0
    assert len(sender.sent) == 1
    key = make_idempotency_key(alert_id="alert-1", tender_id="t-soft")
    assert queue.get(key) is not None
    assert queue.get(key).status == "sent"  # type: ignore[union-attr]


def test_drain_marks_failed_without_resend_on_success_path() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender(fail_next=True)
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    failed = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert failed.digests_failed == 1
    assert failed.items_marked_failed == 2
    assert failed.items_marked_cancelled == 0
    assert len(sender.sent) == 0
    assert all(i.status == "failed" and i.attempts == 1 for i in queue.all_items())


def test_weekly_tuesday_enqueues_without_sending() -> None:
    queue = InMemoryNotificationQueue()
    freqs = {"user-1": "semanal"}
    _enqueue_software_match(queue, job_date=TUESDAY, frequencies=freqs)
    key = make_idempotency_key(alert_id="alert-1", tender_id="t-soft")
    assert queue.get(key) is not None
    assert queue.get(key).status == "pending"  # type: ignore[union-attr]

    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})
    result = drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        frequencies=freqs,
        job_date=TUESDAY,
    )
    assert result.digests_skipped_not_due == 1
    assert result.digests_sent == 0
    assert len(sender.sent) == 0
    assert all(i.status == "pending" for i in queue.all_items())


def test_weekly_monday_drains_pending() -> None:
    queue = InMemoryNotificationQueue()
    freqs = {"user-1": "semanal"}
    # Coincidencias a mitad de semana quedan pending hasta el lunes.
    _enqueue_software_match(queue, job_date=TUESDAY, frequencies=freqs)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    mid = drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        frequencies=freqs,
        job_date=TUESDAY,
    )
    assert mid.digests_sent == 0

    monday = drain_daily_digests(
        queue=queue,
        sender=sender,
        directory=directory,
        frequencies=freqs,
        job_date=MONDAY,
    )
    assert monday.digests_sent == 1
    assert monday.items_marked_sent == 2
    assert "semanal" in sender.sent[0].subject
    assert all(i.status == "sent" for i in queue.all_items())


def test_weekly_same_tender_same_week_is_idempotent() -> None:
    queue = InMemoryNotificationQueue()
    freqs = {"user-1": "semanal"}
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    tenders = [_tender("t-soft", "Mantenimiento de software")]

    first = run_alert_batch(
        alerts=[alert],
        tenders=tenders,
        queue=queue,
        digest=MONDAY,
        frequencies=freqs,
    )
    second = run_alert_batch(
        alerts=[alert],
        tenders=tenders,
        queue=queue,
        digest=TUESDAY,
        frequencies=freqs,
    )
    assert first.enqueued_new == 1
    assert second.enqueued_new == 0
    assert second.enqueued_existing == 1
    assert len(queue.all_items()) == 1
    key = make_idempotency_key(alert_id="alert-1", tender_id="t-soft")
    assert queue.get(key) is not None
    assert "digest" not in queue.get(key).payload  # type: ignore[union-attr]
