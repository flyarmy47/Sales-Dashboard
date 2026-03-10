// netlify/functions/deals.js
// GET  /api/deals           — returns active HubSpot deals
// POST /api/deals           — moves a deal to a new stage
//
// Body for POST: { dealId: "12345", stageId: "986576445" }

const { getDeals, moveDealStage } = require('./_hubspot');
const { createClient }            = require('@supabase/supabase-js');
const { ok, err, preflight, isAuthorized } = require('./_helpers');

// Stage ID → human name map (for activity log)
const STAGE_NAMES = {
  '1018756729': 'Discovery',
  '986576445':  'Quote Prepared',
  '986576447':  'Feasibility',
  '986576449':  'Ops Review',
  '1296484709': 'Contract Out',
  '1018756730': 'Get Back to Me',
  '986576450':  'Closed Won',
  '986576451':  'Closed Lost',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event))           return err('Unauthorized', 401);

  // ── GET — fetch all active deals ──────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const deals = await getDeals();
      const normalized = deals.map(d => ({
        id:       String(d.id),
        name:     d.properties.dealname || '(Unnamed deal)',
        amount:   Number(d.properties.amount) || 0,
        stage:    d.properties.dealstage || '',
        close:    d.properties.closedate
                    ? d.properties.closedate.split('T')[0]
                    : null,
        owner:    d.properties.hubspot_owner_id || null,
      }));
      return ok(normalized);
    } catch (e) {
      return err(e.message);
    }
  }

  // ── POST — move deal stage ─────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let dealId, stageId, dealName;
    try {
      const body = JSON.parse(event.body || '{}');
      dealId   = body.dealId;
      stageId  = body.stageId;
      dealName = body.dealName || '(unknown)';
    } catch {
      return err('Invalid JSON body', 400);
    }

    if (!dealId || !stageId) return err('dealId and stageId are required', 400);

    try {
      const result = await moveDealStage(dealId, stageId);

      // Log to Supabase (best-effort)
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        await supabase.from('activity_log').insert({
          action:      'deal_stage_moved',
          object_type: 'deal',
          object_id:   String(dealId),
          object_name: dealName,
          new_value:   STAGE_NAMES[stageId] || stageId,
          completed_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Supabase log failed (non-fatal):', logErr.message);
      }

      return ok({
        dealId:   String(dealId),
        newStage: result?.properties?.dealstage || stageId,
        message:  `Deal moved to ${STAGE_NAMES[stageId] || stageId}`,
      });

    } catch (e) {
      return err(`Failed to move deal ${dealId}: ${e.message}`, e.status || 500);
    }
  }

  return err('Method not allowed', 405);
};
