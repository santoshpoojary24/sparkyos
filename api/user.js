export default function handler(req, res) {
  res.status(200).json({ user: { role: 'admin', username: 'Root_Admin' } });
}
