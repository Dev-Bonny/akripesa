import { Request, Response, NextFunction } from 'express';
import * as LPOService from './lpo.service';
import { sendSuccess } from '../../utils/apiResponse';

export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaign = await LPOService.createCampaign(req.body, req.user!.userId);
    sendSuccess(res, 201, 'LPO Campaign created successfully.', campaign);
  } catch (err) {
    next(err);
  }
};

export const publishCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaign = await LPOService.publishCampaign(
      req.params.campaignId,
      req.user!.userId
    );
    sendSuccess(res, 200, 'Campaign published and now live for funding.', campaign);
  } catch (err) {
    next(err);
  }
};

export const getAdminCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaign = await LPOService.getCampaignWithInternalData(
      req.params.campaignId
    );
    sendSuccess(res, 200, 'Campaign retrieved.', campaign);
  } catch (err) {
    next(err);
  }
};

export const getPublicCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commodity, page, limit } = req.query;
    const result = await LPOService.getPublicFundingCampaigns({
      commodity: commodity as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    sendSuccess(res, 200, 'Active campaigns retrieved.', result.campaigns, {
      total: result.total,
      pages: result.pages,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaign = await LPOService.updateCampaignDraft(
      req.params.campaignId,
      req.body
    );
    sendSuccess(res, 200, 'Campaign updated.', campaign);
  } catch (err) {
    next(err);
  }
};

// ─── NEW ADMIN CONTROLLERS ADDED BELOW ────────────────────────────────────────

/**
 * GET /api/v1/campaigns/admin/all
 * Returns all campaigns with internal data for the Underwriting Hub.
 */
export const getAllCampaignsForAdmin = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaigns = await LPOService.getAllCampaignsForAdmin();
    sendSuccess(res, 200, 'All campaigns retrieved.', campaigns);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/campaigns/admin/payout-summaries
 * Returns per-campaign payout queue data for the DLQ Monitor.
 */
export const getPayoutSummaries = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summaries = await LPOService.getPayoutSummaries();
    sendSuccess(res, 200, 'Payout summaries retrieved.', summaries);
  } catch (err) {
    next(err);
  }
};