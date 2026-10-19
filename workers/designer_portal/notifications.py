"""Gated transactional notifications. Importing this module never sends mail.

Resend POST /emails: fixed payload + Idempotency-Key (24-hour provider window).
GET /emails/{id}: last_event reconciliation, separate from API acceptance.
See docs/designer-portal/operations.md for source links and activation checks.
"""
from __future__ import annotations
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from worker import rpc, service

EMAIL = re.compile(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
WORKSPACE = re.compile(r'https://[A-Za-z0-9.-]+(?::[0-9]+)?/designer-portal/?')
SUBJECT = 'Your Mr Wallcover workspace has an update'
PREFIX = 'An update is available in your Mr Wallcover workspace. Sign in to review it: '


class ProviderFailure(RuntimeError):
    def __init__(self, status=0, name='transport_failure'):
        super().__init__('Notification provider request could not be confirmed')
        self.status, self.name = status, name


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def resend_request(method, path, payload, headers):
    """Fixed provider origin; never log response bodies or bearer credentials."""
    if not re.fullmatch(r'/emails(?:/[A-Za-z0-9_-]{1,100})?', path):
        raise ValueError('Invalid provider endpoint')
    request = urllib.request.Request('https://api.resend.com'+path,
        data=json.dumps(payload, separators=(',', ':'), sort_keys=True).encode() if payload is not None else None,
        method=method, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            data = response.read(65537)
            if len(data)>65536:
                raise ProviderFailure(0, 'response_limit')
            result = json.loads(data)
            if not isinstance(result, dict):
                raise ProviderFailure(0, 'invalid_response')
            return result
    except urllib.error.HTTPError as error:
        # Error names determine safe retry behavior; the message may contain
        # recipient or provider data and is deliberately never retained.
        try:
            body = json.loads(error.read(65536))
            name = str(body.get('name', 'http_error'))[:80]
        except Exception:
            name = 'http_error'
        raise ProviderFailure(error.code, name) from None
    except ProviderFailure:
        raise
    except (OSError, TimeoutError, ValueError, urllib.error.URLError):
        raise ProviderFailure() from None


def environment(env):
    if env.get('DESIGNER_PORTAL_NOTIFICATIONS_ENABLED')!='true':
        return None
    sender, workspace, key = env.get('DESIGNER_PORTAL_NOTIFICATION_FROM', ''), env.get('DESIGNER_PORTAL_NOTIFICATION_SITE_URL', ''), env.get('RESEND_API_KEY', '')
    if env.get('DESIGNER_PORTAL_NOTIFICATION_PROVIDER')!='resend' or not key or not EMAIL.fullmatch(sender) or not WORKSPACE.fullmatch(workspace):
        return None
    return {'sender':sender.lower(), 'workspace':workspace, 'key':key}


def checked_payload(job, config):
    if job.get('provider')!='resend' or not EMAIL.fullmatch(job.get('recipient_email', '')):
        raise ValueError('Invalid notification recipient')
    identifier = str(uuid.UUID(job['id']))
    str(uuid.UUID(job['lease_token']))
    if job.get('idempotency_key')!='designer-workspace/'+identifier:
        raise ValueError('Invalid notification identity')
    expected = {'from':config['sender'], 'to':[job['recipient_email']], 'subject':SUBJECT, 'text':PREFIX+config['workspace']}
    if job.get('provider_payload')!=expected:
        raise ValueError('Notification message differs from approved generic message')
    return expected


def process_send(job, config, *, rpc_call=rpc, transport=resend_request):
    finish = {'p_id':job['id'], 'p_token':job['lease_token']}
    try:
        payload = checked_payload(job, config)
        # DB rechecks the current membership/verified address, settings and lease
        # immediately before the external operation. Retries retain the same key.
        if not rpc_call('designer_notification_send_authorized', finish):
            return {'state':'not_authorized'}
        headers = {'Authorization':'Bearer '+config['key'], 'Content-Type':'application/json', 'Idempotency-Key':job['idempotency_key']}
        result = transport('POST', '/emails', payload, headers)
        provider_id = result.get('id')
        if not isinstance(provider_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', provider_id):
            outcome, safe_error = 'uncertain', 'Provider acceptance response could not be verified'
        else:
            # Failure to save this result is ambiguous. Do not generate a new
            # message or key; a reclaimed lease uses provider idempotency.
            try:
                rpc_call('designer_finish_notification', {**finish, 'p_outcome':'accepted', 'p_provider_id':provider_id})
                return {'state':'provider_accepted'}
            except Exception:
                return {'state':'reconciliation_pending'}
    except ProviderFailure as error:
        if error.status==409 and error.name=='invalid_idempotent_request':
            outcome, safe_error = 'uncertain', 'Provider idempotency conflict; manual reconciliation required'
        elif not error.status or error.status>=500 or error.status==429 or (error.status==409 and error.name=='concurrent_idempotent_requests'):
            outcome, safe_error = 'retry', 'Provider request could not be confirmed; safe same-key retry pending'
        elif error.status in (400, 401, 403, 404, 422):
            outcome, safe_error = 'failed', 'Provider rejected the notification; owner review required'
        else:
            outcome, safe_error = 'uncertain', 'Provider response requires manual reconciliation'
    except ValueError:
        outcome, safe_error = 'failed', 'Notification configuration or message needs owner review'
    except Exception:
        # A failed DB authorization request has not authorized a provider call.
        return {'state':'reconciliation_pending'}
    result = rpc_call('designer_finish_notification', {**finish, 'p_outcome':outcome, 'p_error':safe_error})
    return {'state':result.get('state', outcome) if isinstance(result, dict) else outcome}


def process_delivery_check(job, config, *, rpc_call=rpc, transport=resend_request):
    args = {'p_id':job['id'], 'p_token':job['delivery_lease_token']}
    try:
        provider_id = job.get('provider_email_id', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', provider_id):
            raise ValueError('Invalid provider email ID')
        data = transport('GET', '/emails/'+provider_id, None, {'Authorization':'Bearer '+config['key']})
        event = data.get('last_event')
        if data.get('id')!=provider_id or not isinstance(event, str) or not re.fullmatch(r'[a-z_]{1,40}', event):
            raise ValueError('Invalid delivery status response')
        result = rpc_call('designer_finish_delivery_check', {**args, 'p_event':event})
        return {'state':result.get('state', 'provider_accepted') if isinstance(result, dict) else 'provider_accepted'}
    except Exception:
        # Failure to check delivery never changes an accepted message to failed
        # or delivered. The bounded polling lease can be reclaimed safely.
        try:
            rpc_call('designer_finish_delivery_check', {**args, 'p_error':'Provider delivery status could not be checked'})
        except Exception:
            pass
        return {'state':'provider_accepted'}


def row(value):
    if isinstance(value, list):
        return row(value[0]) if value else None
    return value if isinstance(value, dict) and value.get('id') else None


def run_once(*, env=None, rpc_call=rpc, service_call=service, transport=resend_request):
    config = environment(os.environ if env is None else env)
    if not config:
        return {'enabled':False, 'reason':'Notifications are not explicitly configured'}
    settings = service_call('/rest/v1/designer_settings?id=eq.true&select=notifications_enabled,notification_provider,notification_sender,notification_workspace_url')
    settings = settings[0] if isinstance(settings, list) and settings else {}
    if not settings.get('notifications_enabled') or settings.get('notification_provider')!='resend' or settings.get('notification_sender')!=config['sender'] or settings.get('notification_workspace_url')!=config['workspace']:
        return {'enabled':False, 'reason':'Database notification settings do not match the approved environment'}
    rpc_call('designer_queue_notifications', {'p_limit':25})
    job = row(rpc_call('designer_claim_notification', {'p_lease_seconds':120}))
    if job:
        return process_send(job, config, rpc_call=rpc_call, transport=transport)
    check = row(rpc_call('designer_claim_delivery_check', {'p_lease_seconds':120}))
    return process_delivery_check(check, config, rpc_call=rpc_call, transport=transport) if check else {'claimed':False}


if __name__=='__main__':
    run_once()
