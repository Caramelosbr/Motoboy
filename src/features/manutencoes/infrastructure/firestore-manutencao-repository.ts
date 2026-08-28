/**
 * Implementação Firestore do ManutencaoRepository (infraestrutura).
 * Guarda cada gasto em users/{uid}/manutencoes, isolado por dono.
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
import type {
  Manutencao,
  ManutencaoRepository,
  EditManutencao,
  NewManutencao,
} from '../domain/manutencao';

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toEntity(snapshot: QueryDocumentSnapshot<DocumentData>): Manutencao {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    category: String(data.category ?? 'maintenance'),
    desc: String(data.desc ?? ''),
    valor: toNumber(data.valor),
    km: data.km === null || data.km === undefined ? null : toNumber(data.km),
    dateISO: String(data.dateISO ?? ''),
    edited: Boolean(data.edited),
    editReason: data.editReason ? String(data.editReason) : null,
    createdAt: toNumber(data.createdAt, Date.now()),
    updatedAt: toNumber(data.updatedAt, Date.now()),
  };
}

export class FirestoreManutencaoRepository implements ManutencaoRepository {
  constructor(private readonly getUid: () => string | null) {}

  private collectionRef(): CollectionReference<DocumentData> {
    const uid = this.getUid();
    if (!uid) throw new Error('Sem usuário autenticado.');
    return collection(db, 'users', uid, 'manutencoes');
  }

  async list(): Promise<Manutencao[]> {
    const snap = await getDocs(query(this.collectionRef(), orderBy('dateISO', 'desc')));
    return snap.docs.map(toEntity);
  }

  observe(callback: (items: Manutencao[]) => void): () => void {
    return onSnapshot(query(this.collectionRef(), orderBy('dateISO', 'desc')), (snap) => {
      callback(snap.docs.map(toEntity));
    });
  }

  async add(data: NewManutencao): Promise<Manutencao> {
    const now = Date.now();
    const payload = {
      category: data.category,
      desc: data.desc,
      valor: data.valor,
      km: data.km ?? null,
      dateISO: data.dateISO,
      edited: false,
      editReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(this.collectionRef(), payload);
    return { id: ref.id, ...payload };
  }

  async update(id: string, data: EditManutencao): Promise<void> {
    const patch: Record<string, unknown> = { edited: true, updatedAt: Date.now() };
    if (data.category !== undefined) patch.category = data.category;
    if (data.desc !== undefined) patch.desc = data.desc;
    if (data.valor !== undefined) patch.valor = data.valor;
    if (data.km !== undefined) patch.km = data.km;
    if (data.dateISO !== undefined) patch.dateISO = data.dateISO;
    if (data.editReason !== undefined) patch.editReason = data.editReason;
    await updateDoc(doc(this.collectionRef(), id), patch);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef(), id));
  }
}
