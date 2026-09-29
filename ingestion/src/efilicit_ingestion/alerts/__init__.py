"""Alertas de usuario (Semana 5). Contrato + motor batch (Paso 7)."""

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.criteria import (
    CRITERIA_EXAMPLE_V1,
    AlertCriteria,
    SearchCriteria,
    parse_criteria,
)
from efilicit_ingestion.alerts.match import evaluate_tender, match_alert_to_tenders
from efilicit_ingestion.alerts.models import AlertMatch, AlertRule, TenderCandidate
from efilicit_ingestion.alerts.queue import (
    InMemoryNotificationQueue,
    make_idempotency_key,
)

__all__ = [
    "AlertCriteria",
    "AlertMatch",
    "AlertRule",
    "CRITERIA_EXAMPLE_V1",
    "InMemoryNotificationQueue",
    "SearchCriteria",
    "TenderCandidate",
    "evaluate_tender",
    "make_idempotency_key",
    "match_alert_to_tenders",
    "parse_criteria",
    "run_alert_batch",
]
