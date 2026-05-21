type AuthSession = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    roles: string[];
  };
};

type Business = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type OrderGroup = {
  id: string;
  status: string;
  paymentStatus: string;
};

type Payment = {
  id: string;
  status: string;
  checkoutUrl?: string;
  clientSecret?: string;
};

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";
const stamp = Date.now();

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const rawBody = await response.text();
  const data = rawBody ? JSON.parse(rawBody) : null;

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function register(input: {
  role: "CUSTOMER" | "BUSINESS_OWNER" | "COURIER";
  emailPrefix: string;
  name: string;
}) {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    body: {
      name: input.name,
      username: `${input.emailPrefix}-${stamp}`,
      email: `${input.emailPrefix}-${stamp}@rapiv.test`,
      password: "Password123!",
      role: input.role
    }
  });
}

async function main() {
  const customer = await register({
    role: "CUSTOMER",
    emailPrefix: "cliente-e2e",
    name: "Cliente E2E"
  });
  const businessOwner = await register({
    role: "BUSINESS_OWNER",
    emailPrefix: "negocio-e2e",
    name: "Responsable E2E"
  });
  const courier = await register({
    role: "COURIER",
    emailPrefix: "repartidor-e2e",
    name: "Repartidor E2E"
  });

  await request("/orders/courier/availability", {
    method: "PATCH",
    token: courier.accessToken,
    body: { status: "AVAILABLE" }
  });

  const business = await request<Business>("/businesses", {
    method: "POST",
    token: businessOwner.accessToken,
    body: {
      name: `Tacos E2E ${stamp}`,
      address: "Centro, Vega de Alatorre, Veracruz",
      latitude: 20.0289,
      longitude: -96.6472
    }
  });

  const product = await request<Product>(`/businesses/${business.id}/products`, {
    method: "POST",
    token: businessOwner.accessToken,
    body: {
      name: `Taco de prueba ${stamp}`,
      category: "Tacos",
      priceCents: 2500,
      image: "https://loremflickr.com/900/600/taco,mexican,food?lock=901001"
    }
  });

  const order = await request<OrderGroup>("/orders", {
    method: "POST",
    token: customer.accessToken,
    headers: { "Idempotency-Key": `order-e2e-${stamp}` },
    body: {
      deliveryAddress: "Centro, Vega de Alatorre, Veracruz",
      latitude: 20.029,
      longitude: -96.648,
      items: [{ productId: product.id, quantity: 2 }]
    }
  });

  const payment = await request<Payment>("/payments", {
    method: "POST",
    token: customer.accessToken,
    headers: { "Idempotency-Key": `payment-e2e-${stamp}` },
    body: { orderGroupId: order.id }
  });

  const businessPending = await request<unknown[]>(`/orders/businesses/${business.id}/pending`, {
    token: businessOwner.accessToken
  });
  const customerOrders = await request<unknown[]>("/orders/mine", {
    token: customer.accessToken
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        accounts: {
          customer: customer.user.email,
          businessOwner: businessOwner.user.email,
          courier: courier.user.email,
          password: "Password123!"
        },
        business: { id: business.id, name: business.name },
        product: { id: product.id, name: product.name },
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus
        },
        payment: {
          id: payment.id,
          status: payment.status,
          checkoutUrl: payment.checkoutUrl ?? payment.clientSecret ?? null
        },
        checks: {
          businessPendingCount: businessPending.length,
          customerOrdersCount: customerOrders.length
        },
        nextManualStep: "Abre payment.checkoutUrl, paga con tarjeta de prueba y vuelve a consultar el pedido."
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
