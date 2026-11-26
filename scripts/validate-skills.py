"""Run the external skill-creator validator without global Python changes."""

import argparse
import hashlib
import importlib.util
import json
import pathlib
from datetime import datetime, timezone
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--validator', required=True, type=pathlib.Path)
parser.add_argument('--dependencies', required=True, type=pathlib.Path)
parser.add_argument('--native-codex-root', required=True, type=pathlib.Path)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(args.dependencies.resolve()))
import yaml

spec = importlib.util.spec_from_file_location('skyops_external_skill_validator', args.validator)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
allowed_extensions = {'tags', 'argument-hint', 'disable-model-invocation'}
base_keys = {'name', 'description', 'license', 'allowed-tools', 'metadata'}
records = []
for source in sorted((root / 'skills').glob('*/SKILL.md')):
    source_ok, source_message = validator.validate_skill(source.parent)
    source_text = source.read_text(encoding='utf-8')
    header = yaml.safe_load(source_text.split('---', 2)[1])
    extensions = set(header) - base_keys
    native = args.native_codex_root / 'skills' / source.parent.name / 'SKILL.md'
    if native.is_symlink() or not native.is_file():
        raise ValueError('Missing or linked generated skill: ' + source.parent.name)
    native_ok, native_message = validator.validate_skill(native.parent)
    records.append({
        'skill': source.parent.name,
        'source_generic_validator_passed': source_ok,
        'source_message': source_message,
        'source_host_extensions': sorted(extensions),
        'source_extension_status': 'none' if not extensions else 'known_host_extensions_preserved' if extensions <= allowed_extensions else 'unmapped_extensions',
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'generated_codex_validator_passed': native_ok,
        'generated_codex_message': native_message,
        'generated_codex_sha256': hashlib.sha256(native.read_bytes()).hexdigest(),
    })
receipt = {
    'schema_version': 1, 'checked_at': datetime.now(timezone.utc).isoformat(),
    'validator': 'External system skill-creator quick_validate.py',
    'validator_sha256': hashlib.sha256(args.validator.read_bytes()).hexdigest(),
    'dependency': 'PyYAML==' + yaml.__version__, 'development_dependency_only': True,
    'source_generic_passed': sum(record['source_generic_validator_passed'] for record in records),
    'source_known_extension_cases': sum(record['source_extension_status'] == 'known_host_extensions_preserved' for record in records),
    'generated_codex_passed': sum(record['generated_codex_validator_passed'] for record in records),
    'skills': records,
    'ok': len(records) == 29 and all(record['generated_codex_validator_passed'] and (record['source_generic_validator_passed'] or record['source_extension_status'] == 'known_host_extensions_preserved') for record in records),
    'phase_gate_passed': False,
    'scope': 'Frontmatter/name/description only; native invocation policies, tool authorization, behavioral skill/agent acceptance and full parity require separate evidence. Canonical host extensions are preserved, not called generic-validator passes.',
}
(root / 'docs/audit/shared-skill-validation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in receipt.items() if key != 'skills'}))
raise SystemExit(0 if receipt['ok'] else 1)
