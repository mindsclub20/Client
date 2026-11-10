import { requireUser, json } from '../lib/access.js';

export async function GET(request) {
  try {
    const current = await requireUser(request);
    if (current.response) return current.response;
    return json({
      user: { id: current.user.id, name: current.profile.full_name || current.user.name, email: current.user.email },
      profile: {
        role: current.profile.role,
        fullName: current.profile.full_name,
        phone: current.profile.phone,
      },
    });
  } catch (error) {
    console.error('session check failed', error?.message);
    return json({ error: 'server_error' }, 500);
  }
}
