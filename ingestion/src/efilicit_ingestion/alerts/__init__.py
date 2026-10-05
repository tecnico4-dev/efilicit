"""Alertas de usuario (Semana 5). Contrato + batch + digest email."""

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.criteria import (
    CRITERIA_EXAMPLE_V1,
    AlertCriteria,
    SearchCriteria,
    parse_criteria,
)
from efilicit_ingestion.alerts.digest import (
    UserEmailDirectory,
    drain_daily_digests,
)
from efilicit_ingestion.alerts.email import FakeEmailSender, ResendEmailSender
from efilicit_ingestion.alerts.match import evaluate_tender, match_alert_to_tenders
from efilicit_ingestion.alerts.models import AlertMatch, AlertRule, TenderCandidate
from efilicit_ingestion.alerts.postgres import PostgresNotificationQueue
from efilicit_ingestion.alerts.queue import (
    InMemoryNotificationQueue,
    digest_period,
    make_idempotency_key,
    should_send_digest,
)

__all__ = [
    "AlertCriteria",
    "AlertMatch",
    "AlertRule",
    "CRITERIA_EXAMPLE_V1",
    "FakeEmailSender",
    "InMemoryNotificationQueue",
    "PostgresNotificationQueue",
    "ResendEmailSender",
    "SearchCriteria",
    "TenderCandidate",
    "UserEmailDirectory",
    "digest_period",
    "drain_daily_digests",
    "evaluate_tender",
    "make_idempotency_key",
    "match_alert_to_tenders",
    "parse_criteria",
    "run_alert_batch",
    "should_send_digest",
]
