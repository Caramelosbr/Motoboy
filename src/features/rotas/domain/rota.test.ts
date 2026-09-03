import { describe, it, expect } from 'vitest';
import {
  createRota,
  validateRota,
  roundRouteValue,
  computeServicoTotal,
  computeRotasValorTotal,
  countAllEntregas,
  computeFuelCost,
  computeRouteResultado,
  computeReceivedPending,
  type NewRota,
  type NewRotaService,
  type Rota,
} from './index';

function novaRota(over: Partial<NewRota> = {}): NewRota {
  const entrega = { endereco: 'Rua A, 100', valor: 15.0, distancia: 3.5, tempo: 10, aproximada: false };
  const service: NewRotaService = {
    coleta: 'Centro',
    cliente: 'João',
    paymentStatus: 'received',
    valorTotal: 15.0,
    entregas: [entrega],
  };
  const base: NewRota = {
    id: 'rota-1700000000000',
    count: 1,
    distancia: 3.5,
    tempoMin: 10,
    valorTotal: 15.0,
    custoCombustivel: 2.65,
    recebidoNaHora: 15.0,
    pendente: 0,
    data: 'Hoje',
    dateISO: '2024-01-15',
    hora: '14:30',
    createdAt: '2024-01-15T14:30:00.000Z',
    consumoKmL: 35,
    precoLitro: 5.3,
    aproximada: false,
    services: [service],
  };
  return { ...base, ...over };
}

describe('roundRouteValue', () => {
  it('arredonda para 2 casas decimais (baixo)', () => {
    expect(roundRouteValue(15.004)).toBe(15.0);
  });
  it('arredonda para 2 casas decimais (cima)', () => {
    expect(roundRouteValue(15.005)).toBe(15.01);
  });
  it('não altera valores já com 2 casas', () => {
    expect(roundRouteValue(15.55)).toBe(15.55);
  });
  it('NaN retorna 0', () => {
    expect(roundRouteValue(NaN)).toBe(0);
  });
  it('Infinity retorna 0', () => {
    expect(roundRouteValue(Infinity)).toBe(0);
  });
  it('zero retorna zero', () => {
    expect(roundRouteValue(0)).toBe(0);
  });
});

describe('computeServicoTotal', () => {
  it('soma os valores das entregas', () => {
    const entregas = [
      { endereco: 'A', valor: 10.5, distancia: 1, tempo: 5, aproximada: false },
      { endereco: 'B', valor: 15.3, distancia: 2, tempo: 8, aproximada: false },
    ];
    expect(computeServicoTotal(entregas)).toBe(25.8);
  });
  it('retorna 0 para array vazio', () => {
    expect(computeServicoTotal([])).toBe(0);
  });
  it('retorna 0 para undefined', () => {
    expect(computeServicoTotal(undefined as unknown as [])).toBe(0);
  });
  it('trata valores undefined/zero', () => {
    const entregas = [
      { endereco: 'A', valor: 0, distancia: null, tempo: null, aproximada: true },
      { endereco: 'B', valor: 20, distancia: 1, tempo: 5, aproximada: false },
    ];
    expect(computeServicoTotal(entregas)).toBe(20);
  });
  it('arredonda o resultado', () => {
    const entregas = [
      { endereco: 'A', valor: 10.005, distancia: 1, tempo: 5, aproximada: false },
    ];
    expect(computeServicoTotal(entregas)).toBe(10.01);
  });
});

describe('computeRotasValorTotal', () => {
  it('soma todas as entregas de todos os serviços', () => {
    const services: NewRotaService[] = [
      {
        coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 25,
        entregas: [
          { endereco: 'X', valor: 10, distancia: 1, tempo: 5, aproximada: false },
          { endereco: 'Y', valor: 15, distancia: 2, tempo: 8, aproximada: false },
        ],
      },
      {
        coleta: 'B', cliente: 'Maria', paymentStatus: 'pending', valorTotal: 15,
        entregas: [{ endereco: 'Z', valor: 15, distancia: 3, tempo: 12, aproximada: false }],
      },
    ];
    expect(computeRotasValorTotal(services)).toBe(40);
  });
  it('retorna 0 para array vazio', () => {
    expect(computeRotasValorTotal([])).toBe(0);
  });
  it('retorna 0 para undefined', () => {
    expect(computeRotasValorTotal(undefined as unknown as [])).toBe(0);
  });
});

describe('countAllEntregas', () => {
  it('conta todas as entregas', () => {
    const services: NewRotaService[] = [
      {
        coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 15,
        entregas: [
          { endereco: 'X', valor: 5, distancia: 1, tempo: 5, aproximada: false },
          { endereco: 'Y', valor: 10, distancia: 2, tempo: 8, aproximada: false },
        ],
      },
      {
        coleta: 'B', cliente: 'Maria', paymentStatus: 'pending', valorTotal: 25,
        entregas: [{ endereco: 'Z', valor: 25, distancia: 3, tempo: 12, aproximada: false }],
      },
    ];
    expect(countAllEntregas(services)).toBe(3);
  });
  it('retorna 0 para array vazio', () => {
    expect(countAllEntregas([])).toBe(0);
  });
});

describe('computeFuelCost', () => {
  it('calcula custo de combustível', () => {
    // (100 km / 35 km/l) * 5.30 = 15.14
    expect(computeFuelCost(100, 35, 5.3)).toBe(15.14);
  });
  it('retorna null quando consumo é 0', () => {
    expect(computeFuelCost(100, 0, 5.3)).toBeNull();
  });
  it('retorna null quando preço é 0', () => {
    expect(computeFuelCost(100, 35, 0)).toBeNull();
  });
  it('retorna null quando km é 0', () => {
    expect(computeFuelCost(0, 35, 5.3)).toBeNull();
  });
  it('retorna null quando consumo é negativo', () => {
    expect(computeFuelCost(100, -5, 5.3)).toBeNull();
  });
  it('retorna null quando preço é negativo', () => {
    expect(computeFuelCost(100, 35, -5.3)).toBeNull();
  });
  it('retorna null para NaN', () => {
    expect(computeFuelCost(NaN, 35, 5.3)).toBeNull();
  });
  it('retorna 0 para distancia 0 com valores positivos', () => {
    expect(computeFuelCost(0, 35, 5.3)).toBeNull();
  });
});

describe('computeRouteResultado', () => {
  it('calcula resultado quando custo é informado', () => {
    expect(computeRouteResultado(50.0, 20.0)).toBe(30.0);
  });
  it('retorna null quando custo é null', () => {
    expect(computeRouteResultado(50.0, null)).toBeNull();
  });
  it('resultado negativo (prejuízo)', () => {
    expect(computeRouteResultado(30.0, 40.0)).toBe(-10);
  });
  it('arredonda o resultado', () => {
    expect(computeRouteResultado(50.01, 20.0)).toBe(30.01);
  });
});

describe('computeReceivedPending', () => {
  const services: NewRotaService[] = [
    {
      coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 25,
      entregas: [
        { endereco: 'X', valor: 10, distancia: 1, tempo: 5, aproximada: false },
        { endereco: 'Y', valor: 15, distancia: 2, tempo: 8, aproximada: false },
      ],
    },
    {
      coleta: 'B', cliente: 'Maria', paymentStatus: 'pending', valorTotal: 15,
      entregas: [{ endereco: 'Z', valor: 15, distancia: 3, tempo: 12, aproximada: false }],
    },
  ];

  it('soma recebidos na hora', () => {
    expect(computeReceivedPending(services).recebido).toBe(25);
  });
  it('soma pendentes', () => {
    expect(computeReceivedPending(services).pendente).toBe(15);
  });
  it('retorna {0,0} para array vazio', () => {
    expect(computeReceivedPending([])).toEqual({ recebido: 0, pendente: 0 });
  });
  it('retorna {0,0} para undefined', () => {
    expect(computeReceivedPending(undefined as unknown as NewRotaService[])).toEqual({ recebido: 0, pendente: 0 });
  });
  it('serviço sem paymentStatus "received" vai para pendente', () => {
    const svcs: NewRotaService[] = [
      {
        coleta: 'A', cliente: 'X', paymentStatus: 'paid', valorTotal: 10,
        entregas: [{ endereco: 'Z', valor: 10, distancia: 1, tempo: 5, aproximada: false }],
      },
    ];
    expect(computeReceivedPending(svcs)).toEqual({ recebido: 0, pendente: 10 });
  });
});

describe('createRota — sucesso', () => {
  it('cria rota válida com resultado computado', () => {
    const r = createRota(novaRota());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.id).toBe('rota-1700000000000');
      expect(r.value.count).toBe(1);
      expect(r.value.valorTotal).toBe(15.0);
      expect(r.value.custoCombustivel).toBe(2.65);
      expect(r.value.resultado).toBe(12.35);
      expect(r.value.recebidoNaHora).toBe(15.0);
      expect(r.value.pendente).toBe(0);
      expect(r.value.aproximada).toBe(false);
      expect(r.value.services).toHaveLength(1);
    }
  });
  it('resultado é null quando custoCombustivel é null', () => {
    const r = createRota(novaRota({ custoCombustivel: null }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.resultado).toBeNull();
  });
  it('não muta o input (services copiados)', () => {
    const input = novaRota();
    createRota(input);
    expect(input.services[0].entregas).toHaveLength(1);
  });
  it('rota com múltiplos serviços e entregas', () => {
    const services: NewRotaService[] = [
      {
        coleta: 'Centro', cliente: 'João', paymentStatus: 'received', valorTotal: 30,
        entregas: [
          { endereco: 'Rua A', valor: 10, distancia: 2, tempo: 5, aproximada: false },
          { endereco: 'Rua B', valor: 20, distancia: 3, tempo: 8, aproximada: true },
        ],
      },
      {
        coleta: 'Shopping', cliente: 'Maria', paymentStatus: 'pending', valorTotal: 25,
        entregas: [
          { endereco: 'Rua C', valor: 15, distancia: 4, tempo: 10, aproximada: false },
          { endereco: 'Rua D', valor: 10, distancia: 1, tempo: 3, aproximada: false },
        ],
      },
    ];
    const r = createRota({
      ...novaRota(),
      count: 4,
      valorTotal: 55,
      custoCombustivel: 10,
      recebidoNaHora: 30,
      pendente: 25,
      services,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.resultado).toBe(45);
      expect(r.value.count).toBe(4);
    }
  });
});

describe('createRota — validação de id', () => {
  it('id vazio', () => {
    const r = createRota(novaRota({ id: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ID');
  });
  it('id com barra', () => {
    const r = createRota(novaRota({ id: 'rota/123' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_ID');
  });
  it('id "." e ".."', () => {
    expect(createRota(novaRota({ id: '.' })).ok).toBe(false);
    expect(createRota(novaRota({ id: '..' })).ok).toBe(false);
  });
  it('id reservado __proto__', () => {
    const r = createRota(novaRota({ id: '__proto__' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_ID');
  });
  it('id muito longo', () => {
    const r = createRota(novaRota({ id: 'a'.repeat(129) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ID_TOO_LONG');
  });
  it('id sem prefixo rota- ainda é aceito (formato flexível)', () => {
    const r = createRota(novaRota({ id: 'minha-rota-1' }));
    expect(r.ok).toBe(true);
  });
});

describe('createRota — validação de count', () => {
  it('count zero', () => {
    const r = createRota(novaRota({ count: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_COUNT');
  });
  it('count não inteiro', () => {
    const r = createRota(novaRota({ count: 1.5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_COUNT');
  });
  it('count não bate com entregas', () => {
    const r = createRota(novaRota({ count: 3 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('COUNT_MISMATCH');
  });
});

describe('createRota — validação de services', () => {
  it('services vazio', () => {
    const r = createRota(novaRota({ services: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_SERVICES');
  });
  it('serviço sem coleta', () => {
    const r = createRota(novaRota({
      services: [{ coleta: '', cliente: 'João', paymentStatus: 'received', valorTotal: 15,
        entregas: [{ endereco: 'A', valor: 15, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_COLETA');
  });
  it('serviço sem cliente', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: '', paymentStatus: 'received', valorTotal: 15,
        entregas: [{ endereco: 'B', valor: 15, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_CLIENTE');
  });
  it('serviço sem paymentStatus', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: '', valorTotal: 15,
        entregas: [{ endereco: 'B', valor: 15, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_PAYMENT_STATUS');
  });
  it('serviço com valorTotal inconsistente', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 20,
        entregas: [{ endereco: 'B', valor: 15, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VALOR_TOTAL_MISMATCH');
  });
  it('serviço sem entregas', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 15,
        entregas: [] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_SERVICES');
  });
  it('entrega sem endereço', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 15,
        entregas: [{ endereco: '', valor: 15, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_ENTREGA_ENDERECO');
  });
  it('entrega com valor negativo', () => {
    const r = createRota(novaRota({
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: 'received', valorTotal: 15,
        entregas: [{ endereco: 'B', valor: -5, distancia: 1, tempo: 5, aproximada: false }] }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_ENTREGA_VALUE');
  });
});

describe('createRota — validação de totais', () => {
  it('valorTotal não bate com soma das entregas', () => {
    const r = createRota(novaRota({ valorTotal: 20 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VALOR_TOTAL_MISMATCH');
  });
  it('recebidoNaHora não bate', () => {
    const r = createRota(novaRota({ recebidoNaHora: 10 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('RECEBIDO_MISMATCH');
  });
  it('pendente não bate', () => {
    const r = createRota(novaRota({ pendente: 10 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PENDENTE_MISMATCH');
  });
});

describe('createRota — validação de valores monetários', () => {
  it('distancia negativa', () => {
    const r = createRota(novaRota({ distancia: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_DISTANCIA');
  });
  it('tempoMin negativo', () => {
    const r = createRota(novaRota({ tempoMin: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_TEMPO');
  });
  it('valorTotal negativo', () => {
    const r = createRota(novaRota({ valorTotal: -5, pendente: 5, recebidoNaHora: 0,
      services: [{ coleta: 'A', cliente: 'João', paymentStatus: 'pending', valorTotal: 0,
        entregas: [{ endereco: 'B', valor: 0, distancia: 0, tempo: 0, aproximada: false }] }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_VALOR_TOTAL');
  });
  it('custoCombustivel negativo', () => {
    const r = createRota(novaRota({ custoCombustivel: -3 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_CUSTO');
  });
  it('recebidoNaHora negativo', () => {
    const r = createRota(novaRota({ recebidoNaHora: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_RECEBIDO');
  });
  it('pendente negativo', () => {
    const r = createRota(novaRota({ pendente: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NEGATIVE_PENDENTE');
  });
  it('consumoKmL zero', () => {
    const r = createRota(novaRota({ consumoKmL: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CONSUMO');
  });
  it('consumoKmL negativo', () => {
    const r = createRota(novaRota({ consumoKmL: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CONSUMO');
  });
  it('precoLitro zero', () => {
    const r = createRota(novaRota({ precoLitro: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_PRECO_LITRO');
  });
  it('precoLitro negativo', () => {
    const r = createRota(novaRota({ precoLitro: -5.3 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_PRECO_LITRO');
  });
});

describe('createRota — validação de campos texto', () => {
  it('data vazia', () => {
    const r = createRota(novaRota({ data: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_DATA');
  });
  it('dateISO vazia', () => {
    const r = createRota(novaRota({ dateISO: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_DATE_ISO');
  });
  it('hora vazia', () => {
    const r = createRota(novaRota({ hora: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_HORA');
  });
  it('createdAt vazia', () => {
    const r = createRota(novaRota({ createdAt: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_CREATED_AT');
  });
});

describe('createRota — determinismo e imutabilidade', () => {
  it('mesma entrada produce mesma saída', () => {
    const input = novaRota();
    const r1 = createRota(input);
    const r2 = createRota(input);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(JSON.stringify(r1.value)).toBe(JSON.stringify(r2.value));
    }
  });
  it('não muta o input original', () => {
    const input = novaRota();
    const snapshot = JSON.stringify(input);
    createRota(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('arredonda valores monetários na saída', () => {
    const rawEntrega = { endereco: 'Rua A, 100', valor: 15.005, distancia: 3.5, tempo: 10, aproximada: false };
    const rawService: NewRotaService = {
      coleta: 'Centro', cliente: 'João', paymentStatus: 'received', valorTotal: 15.005,
      entregas: [rawEntrega],
    };
    const r = createRota(novaRota({
      valorTotal: 15.005,
      recebidoNaHora: 15.005,
      services: [rawService],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.valorTotal).toBe(15.01);
      expect(r.value.recebidoNaHora).toBe(15.01);
    }
  });
});

describe('validateRota — sucesso', () => {
  it('valida rota criada por createRota', () => {
    const r = createRota(novaRota());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(validateRota(r.value).ok).toBe(true);
    }
  });
});

describe('validateRota — falhas', () => {
  function rotaDeInput(input: Partial<NewRota> = {}): Rota {
    const r = createRota(novaRota(input));
    if (!r.ok) throw new Error(`setup falhou: ${r.code} ${r.message}`);
    return r.value;
  }

  it('id inválido', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, id: 'a/b' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('INVALID_ID');
  });
  it('resultado inconsistente', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, resultado: 999 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('RESULTADO_MISMATCH');
  });
  it('valorTotal inconsistente', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, valorTotal: 999 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('VALOR_TOTAL_MISMATCH');
  });
  it('count inconsistente', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, count: 99 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('COUNT_MISMATCH');
  });
  it('recebidoNaHora inconsistente', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, recebidoNaHora: 999 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('RECEBIDO_MISMATCH');
  });
  it('pendente inconsistente', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, pendente: 999 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('PENDENTE_MISMATCH');
  });
  it('services vazio', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, services: [] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('EMPTY_SERVICES');
  });
  it('consumoKmL zero', () => {
    const base = rotaDeInput();
    const v = validateRota({ ...base, consumoKmL: 0 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('INVALID_CONSUMO');
  });
});