/**
 * GET /api/places?q=...
 * Server-side address autocomplete (Google Places if key set, else Photon).
 * Does not expose the API key to the browser.
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}

async function googleAutocomplete(q, key) {
  const url =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json?' +
    new URLSearchParams({
      input: q,
      key,
      components: 'country:au',
      types: 'address',
      language: 'en',
    });
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = await res.json();
  if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
    console.error('places autocomplete', body.status, body.error_message);
    return [];
  }
  return (body.predictions || []).slice(0, 6).map((p) => ({
    label: p.description,
    place_id: p.place_id,
    source: 'google',
  }));
}

async function googleDetails(placeId, key) {
  const url =
    'https://maps.googleapis.com/maps/api/place/details/json?' +
    new URLSearchParams({
      place_id: placeId,
      key,
      fields: 'formatted_address,geometry,name,place_id',
      language: 'en',
    });
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  if (body.status !== 'OK' || !body.result) return null;
  const r = body.result;
  return {
    label: r.formatted_address || r.name,
    place_id: r.place_id || placeId,
    formatted_address: r.formatted_address || r.name,
    name: r.name || r.formatted_address,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
    source: 'google',
  };
}

async function photonSearch(q) {
  const url =
    'https://photon.komoot.io/api/?' +
    new URLSearchParams({
      q,
      lat: '-28.0',
      lon: '153.4',
      limit: '6',
      lang: 'en',
    });
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const body = await res.json();
  const hits = [];
  for (const f of body.features || []) {
    const p = f.properties || {};
    if (p.countrycode && p.countrycode !== 'AU') continue;
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
    const locality = [p.city || p.locality || p.district || p.town, p.state, p.postcode]
      .filter(Boolean)
      .join(' ');
    const label = [street, locality, 'Australia'].filter(Boolean).join(', ');
    if (!label || hits.some((h) => h.label === label)) continue;
    hits.push({
      label,
      place_id: p.osm_id ? `osm:${p.osm_type || 'N'}:${p.osm_id}` : label,
      formatted_address: label,
      name: street || p.name || label,
      lat: coords[1],
      lng: coords[0],
      source: 'photon',
    });
  }
  return hits.slice(0, 6);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').trim().slice(0, 80);
    const placeId = (u.searchParams.get('place_id') || '').trim();
    const key = (env.GOOGLE_MAPS_API_KEY || '').trim();

    if (placeId) {
      if (key && !placeId.startsWith('osm:')) {
        const detail = await googleDetails(placeId, key);
        if (detail) return json({ success: true, result: detail });
      }
      return json({ error: 'Place not found' }, 404);
    }

    if (q.length < 3) return json({ success: true, results: [] });

    if (key) {
      const results = await googleAutocomplete(q, key);
      if (results.length) return json({ success: true, results });
    }

    const results = await photonSearch(q);
    return json({ success: true, results });
  } catch (err) {
    console.error('places error', err);
    return json({ error: 'Address lookup failed', details: String(err.message || err) }, 500);
  }
}
