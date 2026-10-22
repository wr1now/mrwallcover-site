"""Durable pull worker for Room Studio. Defining this app does not deploy it.

All three gates must permit work: worker environment, database feature settings,
and a positive configured budget. Live AI has an additional independent gate.
Run local offline tests without importing/deploying Modal.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

MAX_BYTES=20*1024*1024
BUCKET="room-studio"
ROOT=Path(__file__).resolve().parent
# Official Blender 4.5.0 release checksum, checked 18 October 2026:
# https://download.blender.org/release/Blender4.5/blender-4.5.0.sha256
BLENDER_SHA256="1188b95cc12321c770b631939f7c25a096910b6f884a990bf9c0f62d52b38aec"
BLENDER_VERIFY_CODE="""import hashlib, sys
digest = hashlib.sha256()
with open(sys.argv[1], 'rb') as archive:
    for chunk in iter(lambda: archive.read(1024 * 1024), b''):
        digest.update(chunk)
if digest.hexdigest() != sys.argv[2]:
    raise SystemExit('Blender archive checksum mismatch; extraction stopped')
"""


class TransientWorkerError(RuntimeError):
    pass


def _service(path: str, method: str="GET", payload: Any=None, *, binary: bytes|None=None, mime: str="application/json") -> Any:
    base=os.getenv("SUPABASE_URL","").rstrip("/")
    key=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
    if not re.fullmatch(r"https://[a-z0-9.-]+",base) or not key:
        raise RuntimeError("Private worker storage is not configured")
    data=binary if binary is not None else (json.dumps(payload).encode() if payload is not None else None)
    request=urllib.request.Request(base+path,data=data,method=method,headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":mime})
    try:
        with urllib.request.urlopen(request,timeout=45) as response:
            if path.startswith("/storage/v1/object/authenticated/"):
                result=response.read(MAX_BYTES+1)
                if len(result)>MAX_BYTES:
                    raise ValueError("Asset exceeds the file limit")
                return result
            raw=response.read(2_000_000)
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        # Never put an upstream body, request headers or credential into job errors.
        if error.code==429 or error.code>=500:
            raise TransientWorkerError("Private storage is temporarily unavailable") from error
        raise RuntimeError(f"Private storage operation failed ({error.code})") from error


def _rpc(name: str, payload: dict) -> Any:
    return _service("/rest/v1/rpc/"+name,"POST",payload)


def _rows(table: str, query: str) -> list:
    return _service("/rest/v1/"+table+"?"+query)


def _uuid(value: str) -> str:
    return str(uuid.UUID(value))


def _active(job: dict) -> bool:
    rows=_rows("room_jobs",f"id=eq.{_uuid(job['id'])}&state=eq.running&lease_token=eq.{_uuid(job['lease_token'])}")
    projects=_rows("room_projects",f"id=eq.{_uuid(job['project_id'])}&owner_id=eq.{_uuid(job['owner_id'])}&deleting=eq.false")
    return len(rows)==1 and len(projects)==1


def _asset(job: dict, *, asset_id: str|None=None, storage_path: str|None=None) -> dict:
    prefix=f"{_uuid(job['owner_id'])}/{_uuid(job['project_id'])}/"
    if asset_id:
        selector="id=eq."+_uuid(asset_id)
    else:
        if not storage_path or not storage_path.startswith(prefix) or ".." in storage_path or not re.fullmatch(r"[a-z0-9/-]+\.(png|jpg|webp|pdf|json)",storage_path):
            raise ValueError("Asset path is outside this private project")
        selector="storage_path=eq."+urllib.parse.quote(storage_path,safe="")
    rows=_rows("room_assets",selector+f"&owner_id=eq.{job['owner_id']}&project_id=eq.{job['project_id']}&state=eq.ready")
    if len(rows)!=1:
        raise ValueError("Private asset unavailable")
    return rows[0]


def _download(asset: dict) -> bytes:
    content=_service("/storage/v1/object/authenticated/"+BUCKET+"/"+asset["storage_path"])
    if len(content)!=asset["bytes"] or hashlib.sha256(content).hexdigest()!=asset["sha256"]:
        raise ValueError("Private asset checksum mismatch")
    return content


def _clean_texture(content: bytes, destination: Path, expected_size: tuple[int, int]) -> None:
    from PIL import Image,ImageOps
    import io
    Image.MAX_IMAGE_PIXELS=25_000_000
    with Image.open(io.BytesIO(content)) as source:
        if source.format not in ("JPEG","PNG","WEBP") or source.width*source.height>25_000_000 or getattr(source,"n_frames",1)>1:
            raise ValueError("Unsupported or oversized artwork image")
        image=ImageOps.exif_transpose(source).convert("RGB")
        if image.size != expected_size:
            raise ValueError("Artwork dimensions do not match the approved revision")
        image.save(destination,"PNG")  # Metadata stripped; bounded decompression.


def _store_output(job: dict, kind: str, path: Path) -> dict:
    if not _active(job):
        raise RuntimeError("Job was cancelled or its lease expired")
    payload=path.read_bytes()
    suffix=path.suffix.lower()
    mime={".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".json":"application/json"}.get(suffix)
    if not mime or not 0<len(payload)<=MAX_BYTES:
        raise ValueError("Output exceeds the supported file limit")
    digest=hashlib.sha256(payload).hexdigest()
    asset=_rpc("room_reserve_output",{"p_job":job["id"],"p_token":job["lease_token"],"p_id":str(uuid.uuid4()),"p_mime":mime,"p_bytes":len(payload),"p_sha":digest,"p_extension":suffix[1:]})
    try:
        _service("/storage/v1/object/"+BUCKET+"/"+asset["storage_path"],"POST",binary=payload,mime=mime)
        if not _active(job):
            raise RuntimeError("Job was cancelled or its lease expired")
        _service("/rest/v1/room_assets?id=eq."+asset["id"],"PATCH",{"state":"ready"})
        return {"kind":kind,"storagePath":asset["storage_path"],"sha256":digest,"assetId":asset["id"]}
    except Exception:
        cleanup_output_asset(job["id"],asset["id"])
        raise


def cleanup_output_asset(job_id: str, asset_id: str) -> None:
    # Claim/fence before deleting any bytes: a lost success response must never
    # cause the exception path to remove an already delivered output package.
    asset=_rpc("room_claim_output_cleanup",{"p_job":job_id,"p_asset":asset_id})
    if not asset or not asset.get("id"):return
    _service("/storage/v1/object/"+BUCKET,"DELETE",{"prefixes":[asset["storage_path"]]})
    _rpc("room_release_output",{"p_job":job_id,"p_asset":asset_id})


def cleanup_unpublished_outputs(job: dict) -> None:
    """Recover a killed attempt's registered objects before the next attempt.
    Every attempt uses a new lease. No new output is written until this cleanup
    completes; a stale process cannot reserve more bytes with its old token.
    """
    assets=_rows("room_assets",f"job_id=eq.{_uuid(job['id'])}&kind=eq.output")
    for asset in assets:
        cleanup_output_asset(job["id"],asset["id"])


def output_maintenance() -> None:
    """A second killed attempt has no following worker to clean its objects."""
    assets=_rows("room_assets","select=*,room_jobs!inner(state)&kind=eq.output&room_jobs.state=in.(failed,cancelled)&order=created_at.asc&limit=20")
    for asset in assets:
        cleanup_output_asset(asset["job_id"],asset["id"])


def process_job(job: dict) -> None:
    """One claimed job, maximum ten minutes; there is no recursive retry loop."""
    outputs=[]
    try:
        if os.getenv("ROOM_STUDIO_PAID_JOBS_ENABLED")!="true" or not _active(job):
            raise RuntimeError("Processing is disabled or the job was cancelled")
        cleanup_unpublished_outputs(job)
        with tempfile.TemporaryDirectory(prefix="room-studio-") as temporary:
            working=Path(temporary)
            if job["type"]=="analysis":
                if os.getenv("ROOM_STUDIO_LIVE_AI_ENABLED")!="true":
                    raise ValueError("Live AI analysis is disabled")
                from import_plan import analyse_plan
                asset=_asset(job,asset_id=job["input"]["assetId"])
                plan=working/("plan"+Path(asset["storage_path"]).suffix)
                plan.write_bytes(_download(asset))
                candidate=analyse_plan(str(plan),job["input"].get("pageIndex",0),crop=job["input"].get("crop"))
                result=working/"candidate.json";result.write_text(json.dumps(candidate))
                outputs.append(_store_output(job,"candidate",result))
            elif job["type"]=="render":
                if not job.get("order_id") or job["input"].get("orderId")!=job["order_id"]:
                    raise ValueError("A paid render order is required")
                orders=_rows("room_render_orders",f"id=eq.{_uuid(job['order_id'])}&owner_id=eq.{_uuid(job['owner_id'])}&job_id=eq.{_uuid(job['id'])}&state=eq.running")
                if len(orders)!=1 or not orders[0].get("payment_intent_id") or orders[0]["revision_id"]!=job["revision_id"]:
                    raise ValueError("Paid render entitlement does not match this revision")
                asset=_asset(job,asset_id=job["input"]["packageAssetId"])
                if asset["kind"]!="package" or asset["sha256"]!=job["input"]["packageSha256"]:
                    raise ValueError("Approved render package checksum mismatch")
                package=json.loads(_download(asset))
                if package.get("revisionId")!=job["revision_id"] or package.get("projectId")!=job["project_id"]:
                    raise ValueError("Render package does not match the approved revision")
                texture_dir=working/"textures";texture_dir.mkdir()
                for texture in package.get("textures",[]):
                    texture_id=texture.get("id","")
                    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}",texture_id):
                        raise ValueError("Invalid texture identity")
                    if texture.get("dataUrl"):
                        raise ValueError("Cloud packages cannot contain inline artwork")
                    source=_asset(job,storage_path=texture.get("storagePath"))
                    if source["kind"]!="artwork" or source["sha256"]!=texture["sha256"]:
                        raise ValueError("Wallpaper image does not match the approved revision")
                    _clean_texture(_download(source),texture_dir/(texture_id+".png"),(texture["widthPx"],texture["heightPx"]))
                package_path=working/"package.json";package_path.write_text(json.dumps(package))
                out=working/"outputs";out.mkdir()
                worker_root=Path('/root/room_studio') if Path('/root/room_studio').is_dir() else ROOT
                command=[os.getenv("BLENDER_BIN","/opt/blender/blender"),"-b","--python-exit-code","1","--python",str(worker_root/"render.py"),"--","--package",str(package_path),"--output-dir",str(out),"--texture-dir",str(texture_dir),"--quality","production"]
                subprocess.run(command,check=True,timeout=600,capture_output=True,text=True)
                manifest=json.loads((out/"render-manifest.json").read_text())
                entries=manifest if isinstance(manifest,list) else manifest.get("outputs",[])
                if not isinstance(manifest,dict) or manifest.get("revisionId")!=job["revision_id"] or not manifest.get("renderedGeometryVerified"):
                    raise ValueError("Render manifest does not identify the approved geometry")
                if len(entries)!=3 or {entry.get("kind") for entry in entries}!={"still-1","still-2","panorama"}:
                    raise ValueError("Render manifest must identify two stills and one panorama")
                for entry in entries:
                    expected=(4096,2048) if entry["kind"]=="panorama" else (1920,1080)
                    if (entry.get("width"),entry.get("height"))!=expected:
                        raise ValueError("Rendered output resolution does not match the package")
                    file=(out/Path(entry["path"]).name).resolve()
                    if file.parent!=out.resolve() or not file.is_file():
                        raise ValueError("Render output is missing")
                    if hashlib.sha256(file.read_bytes()).hexdigest()!=entry["sha256"]:
                        raise ValueError("Rendered output checksum mismatch")
                    outputs.append(_store_output(job,entry["kind"],file))
                if len(outputs)!=3:
                    raise ValueError("The package must contain two still views and one panorama")
            else:
                raise ValueError("Unsupported processing job")
        _rpc("room_finish_job",{"p_id":job["id"],"p_token":job["lease_token"],"p_success":True,"p_outputs":outputs,"p_error":None,"p_retryable":False})
    except Exception as error:
        # Delete incomplete output packages: a customer never receives a partial
        # successful result. Snapshot/source uploads remain available for retry.
        for output in outputs:
            cleanup_output_asset(job["id"],output["assetId"])
        if _active(job):
            retryable=isinstance(error,(TimeoutError,subprocess.TimeoutExpired,urllib.error.URLError,TransientWorkerError))
            _rpc("room_finish_job",{"p_id":job["id"],"p_token":job["lease_token"],"p_success":False,"p_outputs":[],"p_error":"Processing could not finish. The saved room and original uploads remain available.","p_retryable":retryable})


def _stripe_request(path: str, payload: dict|None=None, key: str|None=None) -> dict:
    secret=os.getenv("ROOM_STUDIO_STRIPE_SECRET_KEY", "")
    if not (secret.startswith("sk_test_") or (secret.startswith("sk_live_") and os.getenv("ROOM_STUDIO_PAYMENTS_LIVE_ENABLED")=="true")):
        raise RuntimeError("Payment recovery is not configured")
    data=urllib.parse.urlencode(payload).encode() if payload is not None else None
    headers={"Authorization":"Bearer "+secret,"Stripe-Version":"2026-09-30.endive"}
    if data is not None: headers["Content-Type"]="application/x-www-form-urlencoded"
    if key: headers["Idempotency-Key"]=key
    request=urllib.request.Request("https://api.stripe.com/v1/"+path,data=data,headers=headers)
    with urllib.request.urlopen(request,timeout=5) as response:
        return json.loads(response.read(500000))


def payment_maintenance() -> None:
    """Refund recovery continues even when new checkout/compute work is disabled.
    A stable key recovers lost responses. An explicitly failed provider refund
    receives a new generation key; transient failures retain the previous key.
    """
    _rpc("room_expire_checkouts",{})
    _rpc("room_expire_worker_leases",{})
    if not os.getenv("ROOM_STUDIO_STRIPE_SECRET_KEY"):
        return
    # Webhooks are the primary path. Reconciliation recovers a prolonged webhook
    # outage. Unbound sessions are never returned to customers, so a crash before
    # bind leaves an unpaid hold that expires or is resumed with idempotency.
    # Bound sessions can be looked up without customer action; cancelled sessions
    # still get checked because a successful payment may race cancellation.
    import datetime
    now=datetime.datetime.now(datetime.timezone.utc)
    pending=_rows("room_render_orders","state=in.(checkout_pending,expired)&payment_intent_id=is.null&checkout_session_id=not.is.null&payment_check_at=lte."+urllib.parse.quote(now.isoformat(),safe="")+"&order=payment_check_at.asc&limit=3")
    for order in pending:
        session_id=order["checkout_session_id"]
        if not re.fullmatch(r"cs_[A-Za-z0-9_]+",session_id):continue
        try:
            session=_stripe_request("checkout/sessions/"+session_id)
            if session.get("payment_status")!="paid":continue
            metadata=session.get("metadata",{})
            if session.get("client_reference_id")!=metadata.get("orderId") or metadata.get("orderId")!=order["id"]:raise ValueError("Payment reconciliation identity mismatch")
            payment=session.get("payment_intent")
            if isinstance(payment,dict):payment=payment.get("id")
            _rpc("room_receive_payment",{"p_event":"evt_reconcile_"+session_id,"p_kind":"reconciled.checkout.session","p_order":metadata.get("orderId"),"p_session":session_id,"p_payment":payment,"p_amount":session.get("amount_total"),"p_currency":session.get("currency"),"p_owner":metadata.get("ownerId"),"p_project":metadata.get("projectId"),"p_revision":metadata.get("revisionId"),"p_hash":metadata.get("packageSha256")})
        except Exception:
            # Keep the financial obligation visible. The next scheduled run
            # retries; no provider body or customer photo is logged.
            continue
        finally:
            delay=datetime.timedelta(minutes=5 if order["state"]=="checkout_pending" else 60)
            _service("/rest/v1/room_render_orders?id=eq."+_uuid(order["id"]),"PATCH",{"payment_check_at":(now+delay).isoformat()})
    for _ in range(3):
        order=_rpc("room_claim_refund",{})
        if not order or not order.get("id"): return
        refund_id=order.get("refund_id")
        try:
            prior=None
            if refund_id:
                if not re.fullmatch(r"re_[A-Za-z0-9_]+",refund_id): raise ValueError("Invalid refund identity")
                prior=_stripe_request("refunds/"+refund_id)
            if prior and prior.get("status") in ("pending","succeeded"):
                result=prior
            else:
                intent=order["payment_intent_id"]
                if not re.fullmatch(r"pi_[A-Za-z0-9_]+",intent): raise ValueError("Invalid payment identity")
                generation="-after-"+refund_id if refund_id else ""
                result=_stripe_request("refunds",{"payment_intent":intent,"metadata[orderId]":order["id"]},"room-refund-"+order["id"]+generation)
            if result.get("payment_intent")!=order["payment_intent_id"] or result.get("amount")!=order["amount_pence"] or result.get("currency")!=order["currency"]:
                raise ValueError("Full refund does not match the order")
            _rpc("room_finish_refund",{"p_order":order["id"],"p_token":order["refund_token"],"p_refund":result.get("id"),"p_status":result.get("status","failed")})
        except Exception:
            _rpc("room_finish_refund",{"p_order":order["id"],"p_token":order["refund_token"],"p_refund":refund_id,"p_status":"failed"})


def retention_maintenance() -> None:
    """Expiry requires a delivered seven-day notice; missing mail config postpones it."""
    candidates=_rpc("room_retention_candidates",{}) or []
    notices=_rows("room_expiry_notices","delivered_at=is.null")
    token=os.getenv("ROOM_STUDIO_NOTICE_TOKEN","")
    sender=os.getenv("ROOM_STUDIO_NOTICE_FROM","")
    if token and sender:
        for notice in notices:
            user=_service("/auth/v1/admin/users/"+_uuid(notice["owner_id"]))
            email=user.get("email")
            if not email:
                continue
            payload={"from":sender,"to":[email],"subject":"Your Mr Wallcover room is due to expire","text":"Your saved room is due to expire on "+notice["expires_at"][:10]+" after 90 days without an update. Sign in at https://www.mrwallcover.com/room-studio/ to save it again, download an export or delete it now. Your files will be kept for at least seven days after this notice."}
            req=urllib.request.Request("https://api.resend.com/emails",data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+token,"Content-Type":"application/json","Idempotency-Key":"room-expiry-"+notice["project_id"]+"-"+notice["expires_at"][:10]})
            with urllib.request.urlopen(req,timeout=30) as response:
                response.read(10000)
            import datetime
            now=datetime.datetime.now(datetime.timezone.utc).isoformat()
            # Compare expiry as well: saving during email delivery must not attach
            # a stale notice to a newly extended project.
            encoded=urllib.parse.quote(notice["expires_at"],safe="")
            _service("/rest/v1/room_expiry_notices?project_id=eq."+notice["project_id"]+"&expires_at=eq."+encoded,"PATCH",{"delivered_at":now})
            _service("/rest/v1/room_projects?id=eq."+notice["project_id"]+"&expires_at=eq."+encoded,"PATCH",{"expiry_notice_at":now})
    for project in candidates:
        paths=_rpc("room_mark_delete",{"p_owner":project["owner_id"],"p_project":project["id"],"p_expired_only":True})
        if paths is None:
            continue  # Customer saved after the maintenance query: retain it.
        for start in range(0,len(paths),100):
            _service("/storage/v1/object/"+BUCKET,"DELETE",{"prefixes":paths[start:start+100]})
        _service("/rest/v1/room_projects?id=eq."+project["id"]+"&deleting=eq.true","DELETE")
    # Authenticated upload admission lasts two hours. Reap abandoned reservations
    # after that window, fencing completion before deleting any customer bytes.
    import datetime
    cutoff=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=3)).isoformat()
    stale=_rows("room_assets","state=in.(pending,cancelled)&created_at=lt."+urllib.parse.quote(cutoff,safe=""))
    for asset in stale:
        if asset["kind"]=="output" and asset.get("job_id"):
            cleanup_output_asset(asset["job_id"],asset["id"])
            continue
        if asset["kind"] in ("artwork","plan","room-photo","mask"):
            cancelled=_rpc("room_finish_upload",{"p_owner":asset["owner_id"],"p_asset":asset["id"],"p_cancel":True})
            if not cancelled or not cancelled.get("id"):
                continue  # A completed immutable upload won the race.
        _service("/storage/v1/object/"+BUCKET,"DELETE",{"prefixes":[asset["storage_path"]]})
        _service("/rest/v1/room_assets?id=eq."+asset["id"]+"&state=in.(pending,cancelled)","DELETE")


# Modal is deliberately optional for offline tests and syntax checks.
try:
    import modal
except ImportError:
    modal=None

if modal is not None:
    app=modal.App("mrwallcover-room-studio")
    image=(modal.Image.debian_slim(python_version="3.11")
        .apt_install("libgl1","libglib2.0-0","libxrender1","libxi6","libxkbcommon0","curl","xz-utils")
        .pip_install_from_requirements(str(ROOT/"requirements.txt"))
        .run_commands("curl --fail --location https://download.blender.org/release/Blender4.5/blender-4.5.0-linux-x64.tar.xz -o /tmp/blender.tar.xz", f"python -c {shlex.quote(BLENDER_VERIFY_CODE)} /tmp/blender.tar.xz {BLENDER_SHA256} && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz --strip-components=1 -C /opt/blender && rm /tmp/blender.tar.xz")
        .add_local_dir(str(ROOT),remote_path="/root/room_studio"))
    secret=modal.Secret.from_name("mrwallcover-room-studio")

    @app.function(image=image,secrets=[secret],timeout=660,max_containers=2,gpu="L4")
    def render_job(job: dict):
        import sys
        sys.path.insert(0,"/root/room_studio")
        process_job(job)

    @app.function(image=image,secrets=[secret],timeout=660,max_containers=2)
    def analysis_job(job: dict):
        import sys
        sys.path.insert(0,"/root/room_studio")
        process_job(job)

    @app.function(image=image,secrets=[secret],schedule=modal.Period(minutes=1),timeout=60,max_containers=1)
    def dispatch():
        if os.getenv("ROOM_STUDIO_PAID_JOBS_ENABLED")!="true":
            return
        for kind in ("render","analysis"):
            if kind=="analysis" and os.getenv("ROOM_STUDIO_LIVE_AI_ENABLED")!="true":
                continue
            job=_rpc("room_claim_job",{"p_type":kind})
            if job and job.get("id"):
                (render_job if kind=="render" else analysis_job).spawn(job)

    @app.function(image=image,secrets=[secret],schedule=modal.Period(minutes=1),timeout=60,max_containers=1)
    def recover_payments():
        if os.getenv("ROOM_STUDIO_CLOUD_ENABLED")=="true":
            payment_maintenance()
            output_maintenance()

    @app.function(image=image,secrets=[secret],schedule=modal.Period(hours=24),timeout=300,max_containers=1)
    def maintain():
        if os.getenv("ROOM_STUDIO_CLOUD_ENABLED")=="true":
            retention_maintenance()
