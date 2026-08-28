/**
 * Implementação Firestore do AbastecimentoRepository (camada de infraestrutura).
 *
 * Detalhe técnico trocável: guarda cada abastecimento em
 * users/{uid}/abastecimentos, isolado por dono (as regras publicadas garantem
 * que ninguém acesse dados de outro uid). O domínio não sabe que isto existe.
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  type CollectionReference,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../config/firebase.js';
import {
  computeLiters,
  type Abastecimento,
  type AbastecimentoRepository,
  type EditAbastecimento,
  type NewAbastecimento,
} from '../domain/abastecimento';

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toEntity(snapshot: QueryDocumentSnapshot<DocumentData>): Abastecimento {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    dateISO: String(data.dateISO ?? ''),
    location: String(data.location ?? ''),
    paidValue: toNumber(data.paidValue),
    pricePerLiter: toNumber(data.pricePerLiter),
    liters: toNumber(data.liters),
    odometer: data.odometer === null || data.odometer === undefined ? null : toNumber(data.odometer),
    edited: Boolean(data.edited),
    editReason: data.editReason ? String(data.editReason) : null,
    createdAt: toNumber(data.createdAt, Date.now()),
    updatedAt: toNumber(data.updatedAt, Date.now()),
  };
}

export class FirestoreAbastecimentoRepository implements AbastecimentoRepository {
  /** getUid é injetado para o repositório sempre gravar no dono atual. */
  constructor(private readonly getUid: () => string | null) {}

  private collectionRef(): CollectionReference<DocumentData> {
    const uid = this.getUid();
    if (!uid) throw new Error('Sem usuário autenticado.');
    return collection(db, 'users', uid, 'abastecimentos');
  }

  async list(): Promise<Abastecimento[]> {
    const snap = await getDocs(query(this.collectionRef(), orderBy('dateISO', 'desc')));
    return snap.docs.map(toEntity);
  }

  observe(callback: (items: Abastecimento[]) => void): () => void {
    return onSnapshot(query(this.collectionRef(), orderBy('dateISO', 'desc')), (snap) => {
      callback(snap.docs.map(toEntity));
    });
  }

  async add(data: NewAbastecimento): Promise<Abastecimento> {
    const now = Date.now();
    const liters = computeLiters(data.paidValue, data.pricePerLiter);
    const payload = {
      dateISO: data.dateISO,
      location: data.location,
      paidValue: data.paidValue,
      pricePerLiter: data.pricePerLiter,
      liters,
      odometer: data.odometer ?? null,
      edited: false,
      editReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(this.collectionRef(), payload);
    return { id: ref.id, ...payload };
  }

  async update(id: string, data: EditAbastecimento): Promise<void> {
    const patch: Record<string, unknown> = { edited: true, updatedAt: Date.now() };
    if (data.dateISO !== undefined) patch.dateISO = data.dateISO;
    if (data.location !== undefined) patch.location = data.location;
    if (data.paidValue !== undefined) patch.paidValue = data.paidValue;
    if (data.pricePerLiter !== undefined) patch.pricePerLiter = data.pricePerLiter;
    if (data.odometer !== undefined) patch.odometer = data.odometer;
    if (data.editReason !== undefined) patch.editReason = data.editReason;
    // Recalcula litros se valor ou preço mudaram.
    if (data.paidValue !== undefined || data.pricePerLiter !== undefined) {
      // Só recalcula quando ambos vierem juntos; caso contrário mantém o salvo.
      if (data.paidValue !== undefined && data.pricePerLiter !== undefined) {
        patch.liters = computeLiters(data.paidValue, data.pricePerLiter);
      }
    }
    await updateDoc(doc(this.collectionRef(), id), patch);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef(), id));
  }
}
