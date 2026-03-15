import { Router } from 'express';
import { getSetting, saveSetting } from '../utils/cacheRepo';

const router = Router();

// GET all relevant settings
router.get('/settings', (_req, res) => {
  try {
    const settings = {
      cacheData: getSetting('cacheData') === 'true',
      syncEnabled: getSetting('syncEnabled') === 'true',
      downloadImagesLocally: getSetting('downloadImagesLocally') === 'true',
      recursiveHomeSync: getSetting('recursiveHomeSync') === 'true',
      recursiveSeriesSync: getSetting('recursiveSeriesSync') === 'true',
      recursiveConcurrency: parseInt(getSetting('recursiveConcurrency') || '2', 10),
    };
    
    res.json(settings);
  } catch (error) {
    console.error('[API] Error getting settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST update settings
router.post('/settings', (req, res) => {
  try {
    const updates = req.body;
    
    if (typeof updates.cacheData === 'boolean') {
      saveSetting('cacheData', updates.cacheData.toString());
    }
    if (typeof updates.syncEnabled === 'boolean') {
      saveSetting('syncEnabled', updates.syncEnabled.toString());
    }
    if (typeof updates.downloadImagesLocally === 'boolean') {
      saveSetting('downloadImagesLocally', updates.downloadImagesLocally.toString());
    }
    if (typeof updates.recursiveHomeSync === 'boolean') {
      saveSetting('recursiveHomeSync', updates.recursiveHomeSync.toString());
    }
    if (typeof updates.recursiveSeriesSync === 'boolean') {
      saveSetting('recursiveSeriesSync', updates.recursiveSeriesSync.toString());
    }
    if (typeof updates.recursiveConcurrency === 'number') {
      saveSetting('recursiveConcurrency', Math.min(3, Math.max(1, updates.recursiveConcurrency)).toString());
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error saving settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const settingsRoutes = router;
