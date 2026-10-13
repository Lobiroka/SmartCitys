import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as denunciaService from '../services/denunciaService';
import { parsePagination } from '../utils/pagination';

export async function createDenuncia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = denunciaService.validateCreateDenunciaInput(req.body);
    const denuncia = await denunciaService.createDenuncia(req.user!.subject, input, req.user!.email);
    return res.status(201).json(denuncia);
  } catch (err) {
    next(err);
  }
}

export async function listMinhasDenuncias(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const resultado = await denunciaService.listDenunciasByCidadao(req.user!.subject, pagination);
    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function listarFeedDenuncias(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const resultado = await denunciaService.listAllDenuncias(pagination);
    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function getDenunciaDetalhes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const denunciaId = denunciaService.parseDenunciaId(req.params.id);
    const denuncia = await denunciaService.getDenunciaById(req.user!.subject, denunciaId);
    return res.json(denuncia);
  } catch (err) {
    next(err);
  }
}

export async function updateDenuncia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const denunciaId = denunciaService.parseDenunciaId(req.params.id);
    const input = denunciaService.validateCreateDenunciaInput(req.body);
    const denuncia = await denunciaService.updateDenuncia(req.user!.subject, denunciaId, input);
    return res.json(denuncia);
  } catch (err) {
    next(err);
  }
}

export async function deleteDenuncia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const denunciaId = denunciaService.parseDenunciaId(req.params.id);
    await denunciaService.deleteDenuncia(req.user!.subject, denunciaId);
    return res.sendStatus(204);
  } catch (err) {
    next(err);
  }
}
