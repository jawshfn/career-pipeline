"""Versioned identifiers for the JSON workspace backup contract."""

LEGACY_BACKUP_FORMAT = "pursuithq-workspace-backup"
BACKUP_FORMAT = "pursuithq-workspace-backup-v2"
SUPPORTED_BACKUP_FORMATS = frozenset({LEGACY_BACKUP_FORMAT, BACKUP_FORMAT})
