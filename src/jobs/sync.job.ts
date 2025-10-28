// src/jobs/sync.job.ts

import cron from 'node-cron';
import { dantiaService } from '../services/dantia.service';
import Article from '../models/Article.model'; // Your Mongoose model

// Flag to prevent overlapping syncs
let isSyncing = false;

const syncArticles = async () => {
  if (isSyncing) {
    console.log('[CronJob] Previous sync still running. Skipping.');
    return;
  }
  
  isSyncing = true;
  console.log('[CronJob] Starting sync task...');
  
  try {
    // 1. Fetch all articles from Dantia (using the corrected service)
    const allArticles = await dantiaService.fetchAllArticles();

    // If fetch failed or returned nothing, stop here
    if (allArticles.length === 0) {
      console.log('[CronJob] No articles fetched from Dantia (check DantiaService logs). MongoDB not updated.');
      isSyncing = false;
      return;
    }

    // --- CRITICAL FIX for Duplicate Key Error ---
    // 2. Delete ALL existing articles in the collection FIRST
    console.log('[CronJob] Deleting old articles from MongoDB...');
    const deleteResult = await Article.deleteMany({});
    console.log(`[CronJob] ${deleteResult.deletedCount} old articles deleted.`);

    // 3. Insert the newly fetched articles AFTER deletion
    console.log(`[CronJob] Inserting ${allArticles.length} new articles into MongoDB...`);
    await Article.insertMany(allArticles);
    // ---------------------------------------------

    console.log('[CronJob] Sync completed successfully.');

  } catch (error: any) {
    console.error('[CronJob] Error during sync process:', error.message);
    // Log specific Mongoose validation errors if they occur
    if (error.name === 'ValidationError') {
        console.error('[CronJob] Mongoose Validation Error:', error.errors);
    } else if (error.code === 11000) { // Specific log for duplicate key if it somehow happens again
        console.error('[CronJob] MongoDB Duplicate Key Error during insert:', error.keyValue);
    }
  } finally {
     // Ensure the flag is reset even if errors occur
     isSyncing = false; 
     console.log('[CronJob] Sync task finished.');
  }
};

// Schedule the job
export const startSyncJob = () => {
  console.log('[BFF] Sync job configured to run every 5 minutes.');
  
  // Runs every 5 minutes
  cron.schedule('0 3 * * *', () => { 
    syncArticles();
  });

  // Run once immediately on server start
  console.log('[BFF] Running initial sync...');
  syncArticles();
};