const baseUrl = "http://127.0.0.1:3105";
const loginPayload = {
  email: "admin@examops.local",
  password: process.env.SEED_APP_USERS_PASSWORD || "ChangeMe123!"
};

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatCookie(headers) {
  const raw = headers.get("set-cookie");

  if (!raw) {
    return null;
  }

  return raw.split(",").map((item) => item.split(";")[0]).join("; ");
}

async function request(path, options = {}, cookie) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = {
      raw: text
    };
  }

  return {
    response,
    body
  };
}

async function run() {
  const loginForm = new URLSearchParams();
  loginForm.set("email", loginPayload.email);
  loginForm.set("password", loginPayload.password);
  loginForm.set("redirectTo", "/dashboard");
  loginForm.set("locale", "en");

  const loginResponse = await request(
    "/api/auth/login",
    {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: loginForm.toString()
    },
    null
  );

  ensure(
    loginResponse.response.status === 303,
    `Login failed with status ${loginResponse.response.status}: ${JSON.stringify(loginResponse.body)}`
  );
  const cookie = formatCookie(loginResponse.response.headers);
  ensure(cookie, "Missing auth cookie after login");

  const now = Date.now();
  const cycleName = `UI Cycle ${now}`;
  const cycleNameEn = `UI Cycle EN ${now}`;
  const cycleCode = `UI-${now}`;

  const createCycle = await request(
    "/api/cycles",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: cycleCode,
        name: cycleName,
        nameEn: cycleNameEn,
        status: "DRAFT",
        startDate: "2099-01-01",
        endDate: "2099-01-02",
        notes: "UI verification cycle"
      })
    },
    cookie
  );

  ensure(createCycle.response.ok, `Create cycle failed: ${JSON.stringify(createCycle.body)}`);
  ensure(createCycle.body?.ok && createCycle.body?.data?.id, "Cycle create response missing data");
  const cycleId = createCycle.body.data.id;

  const updateCycle = await request(
    `/api/cycles/${cycleId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nameEn: `${cycleNameEn} Updated`
      })
    },
    cookie
  );

  ensure(updateCycle.response.ok, `Update cycle failed: ${JSON.stringify(updateCycle.body)}`);

  const listCycles = await request(
    `/api/cycles?search=${encodeURIComponent(cycleCode)}&page=1&pageSize=10&includeInactive=false`,
    {
      method: "GET"
    },
    cookie
  );

  ensure(listCycles.response.ok, `List cycles failed: ${JSON.stringify(listCycles.body)}`);
  ensure(Array.isArray(listCycles.body?.data) && listCycles.body.data.length > 0, "Cycle search returned no records");

  const buildingsResponse = await request(
    "/api/locations/buildings?includeInactive=false&page=1&pageSize=10",
    {
      method: "GET"
    },
    cookie
  );

  ensure(buildingsResponse.response.ok, `List buildings failed: ${JSON.stringify(buildingsResponse.body)}`);
  const firstBuilding = buildingsResponse.body?.data?.[0];
  ensure(firstBuilding?.id, "No building available for session creation test");

  const createSession = await request(
    "/api/sessions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cycleId,
        name: `UI Session ${now}`,
        nameEn: `UI Session EN ${now}`,
        examType: "EST1",
        startDateTime: "2099-01-01T09:00:00+02:00",
        endDateTime: "2099-01-01T11:00:00+02:00",
        buildingIds: [firstBuilding.id],
        notes: "UI verification session"
      })
    },
    cookie
  );

  ensure(createSession.response.ok, `Create session failed: ${JSON.stringify(createSession.body)}`);
  ensure(createSession.body?.ok && createSession.body?.data?.id, "Session create response missing data");
  const sessionId = createSession.body.data.id;

  const updateSession = await request(
    `/api/sessions/${sessionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        notes: "UI verification session updated"
      })
    },
    cookie
  );

  ensure(updateSession.response.ok, `Update session failed: ${JSON.stringify(updateSession.body)}`);

  const scheduleSession = await request(
    `/api/sessions/${sessionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "SCHEDULED"
      })
    },
    cookie
  );

  ensure(scheduleSession.response.ok, `Schedule session failed: ${JSON.stringify(scheduleSession.body)}`);

  const invalidTransition = await request(
    `/api/sessions/${sessionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "COMPLETED"
      })
    },
    cookie
  );

  ensure(invalidTransition.response.status === 409, "Invalid status transition was not rejected");
  ensure(
    invalidTransition.body?.error === "invalid_session_status_transition",
    `Unexpected invalid transition error: ${JSON.stringify(invalidTransition.body)}`
  );

  const listSessions = await request(
    `/api/sessions?cycleId=${cycleId}&status=SCHEDULED&startFrom=${encodeURIComponent("2099-01-01T00:00:00+02:00")}&endTo=${encodeURIComponent("2099-01-02T00:00:00+02:00")}&page=1&pageSize=10`,
    {
      method: "GET"
    },
    cookie
  );

  ensure(listSessions.response.ok, `List sessions failed: ${JSON.stringify(listSessions.body)}`);
  ensure(Array.isArray(listSessions.body?.data) && listSessions.body.data.length > 0, "Session list filters returned no records");

  const deactivateSession = await request(
    `/api/sessions/${sessionId}`,
    {
      method: "DELETE"
    },
    cookie
  );
  ensure(deactivateSession.response.ok, `Deactivate session failed: ${JSON.stringify(deactivateSession.body)}`);

  const deactivateCycle = await request(
    `/api/cycles/${cycleId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        isActive: false
      })
    },
    cookie
  );
  ensure(deactivateCycle.response.ok, `Deactivate cycle failed: ${JSON.stringify(deactivateCycle.body)}`);

  console.log(
    JSON.stringify(
      {
        cycleId,
        sessionId,
        cycleListCount: listCycles.body?.data?.length ?? 0,
        sessionListCount: listSessions.body?.data?.length ?? 0,
        invalidTransitionError: invalidTransition.body?.error
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
