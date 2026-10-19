import { useState } from 'react';
import type { PortalCloud } from './cloud';

interface NotificationConfiguration {
  enabled: boolean;
  provider: 'resend';
  sender: string | null;
  workspaceUrl: string | null;
  monthlyCap: number | null;
  dailyStudioCap: number | null;
  monthlyBudgetPence: number | null;
  worstCaseAttemptPence: number | null;
}
interface NotificationUsage { month: string; reserved_count: number; committed_count: number; reserved_pence: number; committed_pence: number }
interface NotificationSettings { configuration: NotificationConfiguration; usage?: NotificationUsage[] }
export interface ProjectNotification {
  id: string;
  state: 'queued' | 'running' | 'provider_accepted' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'uncertain' | 'cancelled';
  recipientUserId: string;
  attempts: number;
  providerAcceptedAt: string | null;
  deliveredAt: string | null;
  providerEvent: string | null;
  error: string | null;
  createdAt: string;
}
type Runner = (work: () => Promise<void>) => Promise<void>;
const timestamp = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London' });
const amount = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);

/** Owner-only settings. The server enforces identity, field bounds and activation. */
export default function NotificationFields({ cloud, busy, run, onMessage }: { cloud: PortalCloud; busy: boolean; run: Runner; onMessage: (message: string) => void }) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [savedEnabled, setSavedEnabled] = useState<boolean | null>(null);
  async function receive(value: NotificationSettings) { setSettings(value); setSavedEnabled(value.configuration.enabled); }
  return <details>
    <summary>Project email notifications</summary>
    <p>Configure bounded project updates to eligible workspace accounts. Recipient selection comes from the protected service; this screen cannot send an arbitrary message or choose a recipient.</p>
    <p className="dp-hint">This optional adapter uses Resend. Its published policy stores email and log data in the US; review this before enabling it. Messages contain a generic workspace link, with no project documents, address or prices. <a href="https://resend.com/security" target="_blank" rel="noopener noreferrer">Provider data policy</a></p>
    <button type="button" className="mw-action mw-action--secondary" disabled={busy} onClick={() => void run(async () => { await receive(await cloud.action<NotificationSettings>('admin.notifications.get')); })}><span>Load notification settings</span></button>
    {settings && <form onSubmit={event => { event.preventDefault(); void run(async () => { const next = await cloud.action<NotificationSettings>('admin.notifications.save', settings.configuration as unknown as Record<string, unknown>); await receive(next); onMessage(next.configuration.enabled ? 'Notification settings saved as enabled. Check project records for actual provider acceptance and delivery.' : 'Notification settings saved as disabled.'); }); }}>
      <p className="dp-notice">{savedEnabled ? 'Saved notification setting: enabled. Provider setup and actual delivery still need verification.' : 'Saved notification setting: disabled. No delivery is implied by a queued project record.'}</p>
      <label className="dp-checkbox"><input type="checkbox" checked={settings.configuration.enabled} onChange={event => setSettings({ ...settings, configuration: { ...settings.configuration, enabled: event.target.checked } })} /><span>Enable the configured project notifications within the approved limits.</span></label>
      <div className="dp-fields">
        <label className="dp-field"><span>Notification provider</span><input readOnly value="Resend" /></label>
        <label className="dp-field"><span>Verified sender email</span><input type="email" autoComplete="off" value={settings.configuration.sender || ''} onChange={event => setSettings({ ...settings, configuration: { ...settings.configuration, sender: event.target.value || null } })} /><small>Use a plain email address on a verified sender domain. Provider credentials stay in server secrets.</small></label>
        <label className="dp-field dp-full"><span>Private workspace URL</span><input type="url" value={settings.configuration.workspaceUrl || ''} onChange={event => setSettings({ ...settings, configuration: { ...settings.configuration, workspaceUrl: event.target.value || null } })} /><small>Use the approved HTTPS address ending in /designer-portal/. Notifications direct members to their authenticated workspace.</small></label>
        {(['monthlyCap', 'dailyStudioCap'] as const).map((key, index) => <label className="dp-field" key={key}><span>{index === 0 ? 'Monthly notification count ceiling' : 'Daily count ceiling per studio'}</span><input type="number" min={1} step={1} inputMode="numeric" value={settings.configuration[key] ?? ''} onChange={event => setSettings({ ...settings, configuration: { ...settings.configuration, [key]: event.target.value === '' ? null : Number(event.target.value) } })} /><small>A positive approved limit is required before activation.</small></label>)}
        {(['monthlyBudgetPence', 'worstCaseAttemptPence'] as const).map((key, index) => <label className="dp-field" key={key}><span>{index === 0 ? 'Monthly notification budget ceiling · GBP' : 'Worst-case cost per attempt · GBP'}</span><input type="number" min={0.01} step={0.01} inputMode="decimal" value={settings.configuration[key] === null ? '' : settings.configuration[key]! / 100} onChange={event => setSettings({ ...settings, configuration: { ...settings.configuration, [key]: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100) } })} /><small>{index === 0 ? 'The ceiling must cover all three permitted attempt reservations.' : 'Enter the reviewed worst-case provider cost. The service reserves bounded attempts before processing.'}</small></label>)}
      </div>
      <p className="dp-hint">Saving these settings does not deploy the notifier, verify the sender or validate delivery checks. Provider acceptance and confirmed delivery remain separate recorded states. Uncertain outcomes require staff review.</p>
      <button type="submit" className="mw-action mw-action--primary" disabled={busy}><span>Validate and save notification settings</span></button>
      {Boolean(settings.usage?.length) && <div className="dp-table-scroll"><h4>Recorded notification usage</h4><p className="dp-hint">Reservations and commitments measure limits; they are not a count of delivered emails.</p><table><thead><tr><th scope="col">Month</th><th scope="col">Reserved count</th><th scope="col">Committed count</th><th scope="col">Reserved budget</th><th scope="col">Committed budget</th></tr></thead><tbody>{settings.usage!.map(row => <tr key={row.month}><th scope="row">{row.month}</th><td>{row.reserved_count}</td><td>{row.committed_count}</td><td>{amount(row.reserved_pence)}</td><td>{amount(row.committed_pence)}</td></tr>)}</tbody></table></div>}
    </form>}
  </details>;
}

/** Status reads are explicit; no send/retry action is offered by this component. */
export function ProjectNotificationStatus({ cloud, projectId, notifications, busy, run, onUpdate }: { cloud: PortalCloud; projectId: string; notifications: ProjectNotification[]; busy: boolean; run: Runner; onUpdate: (values: ProjectNotification[]) => void }) {
  return <details className="dp-account">
    <summary>Project notification status{notifications.length ? ` · ${notifications.length} records` : ''}</summary>
    <p>These are service records for this saved project. A queued record is not proof of sending, and provider acceptance is not delivery confirmation.</p>
    <button type="button" className="mw-action mw-action--secondary" disabled={busy} onClick={() => void run(async () => { const result = await cloud.action<{ notifications: ProjectNotification[] }>('notifications.status', { projectId }); onUpdate(result.notifications); })}><span>Refresh notification status</span></button>
    {notifications.length ? <ul className="dp-record-list">{notifications.map(record => <li key={record.id}>
      <div><strong>{record.state.replaceAll('_', ' ')}</strong><span className="dp-tag">{record.attempts} {record.attempts === 1 ? 'attempt' : 'attempts'}</span><small>Recorded {timestamp(record.createdAt)}</small></div>
      <p className="dp-hint">Update for a verified workspace member.</p>
      {record.providerAcceptedAt && <p>Provider accepted: {timestamp(record.providerAcceptedAt)}.{!record.deliveredAt && ' Delivery has not been confirmed.'}</p>}
      {record.deliveredAt && <p>Delivery confirmed: {timestamp(record.deliveredAt)}.</p>}
      {record.providerEvent && <p>Latest provider event: {record.providerEvent.replaceAll('_', ' ')}.</p>}
      {record.error && <p className="dp-notice">{record.error}</p>}
      {record.state === 'uncertain' && <p>Staff review is required before any further action. This screen does not retry an uncertain send.</p>}
    </li>)}</ul> : <p className="dp-empty">No notification records were returned for this project.</p>}
  </details>;
}
