import { pool } from '../lib/db.js';
import { json } from '../lib/access.js';

export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT id,title,description,url FROM public.maxweb_demos WHERE active=true ORDER BY sort_order,title LIMIT 30'
    );
    return json({ demos: rows });
  } catch (error) {
    console.error('public demos failed', error?.message);
    return json({ error: 'demos_unavailable' }, 503);
  }
}
