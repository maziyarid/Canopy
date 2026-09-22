# Ms Robot analytics gateway

Local-only provider gateway for AAX-50/AAX-66/AAX-67/AAX-68.

## Contract
- binds to 127.0.0.1 by default;
- bearer auth is required for provider/sync endpoints;
- /health is unauthenticated for local service checks;
- credentials stay in the server environment/secret store;
- provider failures degrade independently and never erase historical state;
- unconfigured providers are explicit rather than simulated.

## Runtime
Repository source is deployed to /srv/ms-robot-analytics/gateway.py.
State is stored in /var/lib/ms-robot-analytics/state.sqlite3.
The systemd unit reads /etc/ms-robot-analytics.env.

Provider adapters are activated only after real credentials and live read-back verification.
