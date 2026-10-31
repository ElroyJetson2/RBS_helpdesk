import { notifyStatusChange, notifyAssignment } from '../../lib/email.js';
import { json, getStaffFromRequest, VALID_STATUSES, statusLabel } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const staff = await getStaffFromRequest(env, request);
  if (!staff) return json({ error: 'Unauthorized' }, 401);

  if (staff.role === 'viewer') {
    return json({ error: 'Viewers cannot update jobs' }, 403);
  }

  try {
    const body = await request.json();
    const reference = (body.reference || '').trim().toUpperCase();
    const status = body.status;
    const note = (body.note || '').trim();
    let assignedTo = body.assigned_to !== undefined ? (body.assigned_to || '').trim() : undefined;

    if (!reference) return json({ error: 'Reference required' }, 400);
    if (status && !VALID_STATUSES.includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }

    const incident = await env.DB.prepare(
      `SELECT i.*, d.name AS development_name FROM incidents i
       JOIN developments d ON d.id = i.development_id WHERE i.reference = ?`
    ).bind(reference).first();

    if (!incident) return json({ error: 'Incident not found' }, 404);

    if (staff.role === 'contractor') {
      const myName = staff.display_name;
      const myUser = staff.username;
      if (incident.assigned_to !== myName && incident.assigned_to !== myUser) {
        return json({ error: 'You can only update jobs assigned to you' }, 403);
      }
      assignedTo = undefined;
    }

    const newStatus = status || incident.status;
    const newAssigned = assignedTo !== undefined ? (assignedTo || null) : incident.assigned_to;
    const statusChanged = newStatus !== incident.status;
    const assignmentChanged = assignedTo !== undefined && (assignedTo || null) !== (incident.assigned_to || null);

    await env.DB.prepare(
      `UPDATE incidents SET status = ?, assigned_to = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newStatus, newAssigned, incident.id).run();

    let updateNote = note;
    if (!updateNote) {
      const parts = [];
      if (statusChanged) parts.push(`Status changed to ${statusLabel(newStatus)}`);
      if (assignmentChanged) parts.push(newAssigned ? `Assigned to ${newAssigned}` : 'Unassigned');
      updateNote = parts.join('. ') || 'Update added';
    }

    await env.DB.prepare(
      `INSERT INTO updates (incident_id, status, note, created_by) VALUES (?, ?, ?, ?)`
    ).bind(incident.id, newStatus, updateNote, staff.display_name || staff.username).run();

    const updated = { ...incident, status: newStatus, assigned_to: newAssigned };

    if (statusChanged || note) {
      context.waitUntil(notifyStatusChange(env, updated, updateNote));
    }
    if (assignmentChanged && newAssigned) {
      context.waitUntil(notifyAssignment(env, updated, newAssigned));
    }

    return json({ success: true, status: newStatus, assigned_to: newAssigned });
  } catch (err) {
    console.error('Update failed', err);
    return json({ error: 'Update failed', details: err.message }, 500);
  }
}
