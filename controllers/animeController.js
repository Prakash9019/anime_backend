// backend/controllers/animeController.js
const Anime = require('../models/Anime');
const Episode = require('../models/Episode');
const Rating = require('../models/Rating');
const malService = require('../services/malService');
const jikanService = require('../services/jikanServices');

// exports.getAnimeList = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 20,
//       sort = 'createdAt',
//       search,
//       genre,
//       status
//     } = req.query;

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Build query
//     let query = {};
    
//     if (search) {
//       query.title = { $regex: search, $options: 'i' };
//     }
    
//     if (genre) {
//       query.genres = { $in: [genre] };
//     }
    
//     if (status) {
//       query.status = status;
//     }

//     // Build sort object
//     let sortObj = {};
//     switch (sort) {
//       case 'rating':
//         sortObj = { averageRating: -1, title: 1 };
//         break;
//       case 'title':
//         sortObj = { title: 1 };
//         break;
//       case 'newest':
//         sortObj = { createdAt: -1 };
//         break;
//       default:
//         sortObj = { createdAt: -1 };
//     }

//     // Execute query with pagination
//     const [anime, total] = await Promise.all([
//       Anime.find(query)
//         .sort(sortObj)
//         .skip(skip)
//         .limit(limitNum)
//         .populate('episodes', 'number title')
//         .lean(),
//       Anime.countDocuments(query)
//     ]);

//     // Add rank based on rating for display
//     const animeWithRank = anime.map((item, index) => ({
//       ...item,
//       rank: skip + index + 1
//     }));

//     res.json({
//       anime: animeWithRank,
//       pagination: {
//         current: pageNum,
//         pages: Math.ceil(total / limitNum),
//         total,
//         limit: limitNum,
//         hasNext: pageNum < Math.ceil(total / limitNum),
//         hasPrev: pageNum > 1
//       }
//     });
//   } catch (error) {
//     console.error('Get anime list error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// controllers/animeController.js
exports.getAnimeList = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Get all anime
    const animeList = await Anime.find(query)
      .populate('episodes')
      .lean();

    // Calculate average rating for each anime from its episodes
    const animeWithRatings = animeList.map(anime => {
      let totalRating = 0;
      let ratedEpisodesCount = 0;

      if (anime.episodes && anime.episodes.length > 0) {
        anime.episodes.forEach(episode => {
          if (episode.averageRating > 0) {
            totalRating += episode.averageRating;
            ratedEpisodesCount++;
          }
        });
      }

      const averageRating = ratedEpisodesCount > 0 
        ? totalRating / ratedEpisodesCount 
        : 0;

      return {
        ...anime,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        ratedEpisodesCount
      };
    });

    // Sort by average rating (highest first)
    animeWithRatings.sort((a, b) => b.averageRating - a.averageRating);

    // Add rank based on sorted position
    const rankedAnime = animeWithRatings.map((anime, index) => ({
      ...anime,
      rank: index + 1
    }));

    // Paginate results
    const paginatedAnime = rankedAnime.slice(skip, skip + parseInt(limit));

    res.json({
      anime: paginatedAnime,
      pagination: {
        current: parseInt(page),
        total: rankedAnime.length,
        pages: Math.ceil(rankedAnime.length / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error('Get anime list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get single anime by ID with episodes and ratings
exports.getAnimeById = async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id)
      .populate('episodes')
      .populate('userRatings.user', 'name avatar');

    if (!anime) {
      return res.status(404).json({ message: 'Anime not found' });
    }

    res.json(anime);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateAnimeDetails = async (req, res) => {
  try {
    const anime = await Anime.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!anime) return res.status(404).json({ message: 'Anime not found' });
    res.json({ message: 'Anime updated successfully', anime });
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
}
// Rate an anime
exports.rateAnime = async (req, res) => {
  try {
    const { animeId, rating, review } = req.body;
    const userId = req.user.id;

    if (rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Rating must be between 1 and 10' });
    }

    const anime = await Anime.findById(animeId);
    if (!anime) {
      return res.status(404).json({ message: 'Anime not found' });
    }

    // Check if user already rated this anime
    const existingRatingIndex = anime.userRatings.findIndex(
      r => r.user.toString() === userId
    );

    if (existingRatingIndex > -1) {
      // Update existing rating
      anime.userRatings[existingRatingIndex].rating = rating;
    } else {
      // Add new rating
      anime.userRatings.push({ user: userId, rating });
    }

    anime.averageRating = anime.calculateAverageRating();
    await anime.save();

    // Save rating record
    let ratingRecord = await Rating.findOne({ user: userId, anime: animeId });
    if (ratingRecord) {
      ratingRecord.rating = rating;
      ratingRecord.review = review;
    } else {
      ratingRecord = new Rating({ user: userId, anime: animeId, rating, review });
    }
    await ratingRecord.save();

    res.json({ message: 'Rating saved successfully', averageRating: anime.averageRating });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Sync anime from MAL API with episodes
exports.syncWithMAL = async (req, res) => {
  try {
    console.log('Starting MAL sync with episodes...');
    
    const malData = await malService.getAnimeRanking({ limit: 50 });
    
    let syncedAnime = 0;
    let syncedEpisodes = 0;
    
    for (const item of malData.data) {
      const animeData = item.node;
      
      const existingAnime = await Anime.findOne({ malId: animeData.id });
      
      if (!existingAnime) {
        const newAnime = new Anime({
          malId: animeData.id,
          title: animeData.title,
          titleEnglish: animeData.alternative_titles?.en,
          titleJapanese: animeData.alternative_titles?.ja,
          synopsis: animeData.synopsis,
          poster: animeData.main_picture?.large || animeData.main_picture?.medium,
          type: animeData.media_type,
          status: animeData.status,
          startDate: animeData.start_date,
          endDate: animeData.end_date,
          genres: animeData.genres?.map(g => g.name) || [],
          studios: animeData.studios?.map(s => s.name) || [],
          source: animeData.source,
          rating: animeData.rating,
          popularity: animeData.popularity,
          rank: item.ranking?.rank,
          numEpisodes: animeData.num_episodes,
        });
        
        await newAnime.save();
        syncedAnime++;
        
        // Sync episodes using Jikan API
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
          
          const jikanEpisodes = await jikanService.getAnimeEpisodes(animeData.id);
          
          for (const ep of jikanEpisodes.slice(0, 25)) {
            const newEpisode = new Episode({
              anime: newAnime._id,
              number: ep.mal_id || ep.episode,
              title: ep.title || `Episode ${ep.mal_id || ep.episode}`,
              synopsis: ep.synopsis || '',
              airDate: ep.aired ? new Date(ep.aired) : null,
              duration: ep.duration || null,
            });
            
            await newEpisode.save();
            newAnime.episodes.push(newEpisode._id);
            syncedEpisodes++;
          }
          
          await newAnime.save();
          console.log(`Synced ${jikanEpisodes.length} episodes for ${newAnime.title}`);
          
        } catch (episodeError) {
          console.error(`Error syncing episodes for ${animeData.title}:`, episodeError);
        }
      }
    }
    
    res.json({ 
      message: `Sync complete: ${syncedAnime} anime, ${syncedEpisodes} episodes`,
      anime: syncedAnime,
      episodes: syncedEpisodes,
      total: malData.data.length 
    });
  } catch (error) {
    console.error('MAL sync error:', error);
    res.status(500).json({ message: 'Failed to sync with MAL', error: error.message });
  }
};

// Sync episodes for all existing anime without episodes
exports.syncAllEpisodes = async (req, res) => {
  try {
    const animeList = await Anime.find({ 
      malId: { $exists: true, $ne: null },
      episodes: { $size: 0 }
    }).limit(20);
    
    let totalSynced = 0;
    
    for (const anime of animeList) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const jikanEpisodes = await jikanService.getAnimeEpisodes(anime.malId);
        
        for (const ep of jikanEpisodes.slice(0, 50)) {
          const existingEpisode = await Episode.findOne({ 
            anime: anime._id, 
            number: ep.mal_id || ep.episode
          });

          if (!existingEpisode) {
            const newEpisode = new Episode({
              anime: anime._id,
              number: ep.mal_id || ep.episode,
              title: ep.title || `Episode ${ep.mal_id || ep.episode}`,
              synopsis: ep.synopsis || '',
              airDate: ep.aired ? new Date(ep.aired) : null,
              duration: ep.duration || null,
            });

            await newEpisode.save();
            anime.episodes.push(newEpisode._id);
            totalSynced++;
          }
        }
        
        await anime.save();
        console.log(`Synced episodes for ${anime.title}`);
        
      } catch (error) {
        console.error(`Error syncing episodes for ${anime.title}:`, error);
        continue;
      }
    }

    res.json({ 
      message: `Synced ${totalSynced} episodes across ${animeList.length} anime`,
      episodes: totalSynced,
      animeProcessed: animeList.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing episodes', error: error.message });
  }
};

// // Sync episodes for a specific anime
// exports.syncEpisodesFromJikan = async (req, res) => {
//   try {
//     const anime = await Anime.findById(req.params.id);
//     if (!anime || !anime.malId) {
//       return res.status(404).json({ message: 'Anime not found or missing MAL ID' });
//     }

//     const jikanEpisodes = await jikanService.getAnimeEpisodes(anime.malId);
//     let count = 0;

//     for (const ep of jikanEpisodes) {
//       const exists = await Episode.findOne({ 
//         anime: anime._id, 
//         number: ep.mal_id || ep.episode 
//       });
      
//       if (!exists) {
//         const newEp = new Episode({
//           anime: anime._id,
//           number: ep.mal_id || ep.episode,
//           title: ep.title || `Episode ${ep.mal_id || ep.episode}`,
//           synopsis: ep.synopsis,
//           airDate: ep.aired ? new Date(ep.aired) : undefined,
//           duration: ep.duration,
//         });
//         await newEp.save();
//         anime.episodes.push(newEp._id);
//         count++;
//       }
//     }
    
//     await anime.save();
//     res.json({ 
//       message: `Synced ${count} episodes for ${anime.title}`, 
//       total: count 
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Error syncing episodes', error: error.message });
//   }
// };

// Search anime (optional - if you want search functionality)
exports.searchAnime = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }
    
    const anime = await Anime.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { titleEnglish: { $regex: query, $options: 'i' } },
        { genres: { $in: [new RegExp(query, 'i')] } }
      ]
    }).limit(parseInt(limit));
    
    res.json({ results: anime, total: anime.length });
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

// When an episode is rated, update the parent anime's average rating
const updateAnimeAverageRating = async (animeId) => {
  const anime = await Anime.findById(animeId).populate('episodes');
  
  let totalRating = 0;
  let ratedCount = 0;

  anime.episodes.forEach(ep => {
    if (ep.averageRating > 0) {
      totalRating += ep.averageRating;
      ratedCount++;
    }
  });

  const averageRating = ratedCount > 0 ? totalRating / ratedCount : 0;
  
  await Anime.findByIdAndUpdate(animeId, { 
    averageRating: Math.round(averageRating * 10) / 10 
  });
};

// backend/controllers/animeController.js (update rateEpisode function)
exports.rateEpisode = async (req, res) => {
  try {
    const { episodeId, rating } = req.body;
    const userId = req.user.id;

    if (rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Rating must be between 1 and 10' });
    }

    const episode = await Episode.findById(episodeId).populate('anime');
    await updateAnimeAverageRating(episode.anime._id);
    if (!episode) {
      return res.status(404).json({ message: 'Episode not found' });
    }

    const existingRatingIndex = episode.userRatings.findIndex(
      r => r.user.toString() === userId
    );

    if (existingRatingIndex > -1) {
      episode.userRatings[existingRatingIndex].rating = rating;
    } else {
      episode.userRatings.push({ user: userId, rating });
    }

    // Calculate episode average
    const sum = episode.userRatings.reduce((acc, r) => acc + r.rating, 0);
    episode.averageRating = sum / episode.userRatings.length;
    await episode.save();

    // Update anime overall rating based on all episodes
    const anime = await Anime.findById(episode.anime._id).populate('episodes');
    const episodeRatings = anime.episodes
      .filter(ep => ep.averageRating > 0)
      .map(ep => ep.averageRating);
    
    if (episodeRatings.length > 0) {
      const overallRating = episodeRatings.reduce((a, b) => a + b, 0) / episodeRatings.length;
      anime.averageRating = overallRating;
      await anime.save();
    }

    // Save rating record
    let ratingRecord = await Rating.findOne({ user: userId, episode: episodeId });
    if (ratingRecord) {
      ratingRecord.rating = rating;
    } else {
      ratingRecord = new Rating({ user: userId, episode: episodeId, rating });
    }
    await ratingRecord.save();

    res.json({ 
      message: 'Episode rating saved successfully',
      episodeRating: episode.averageRating,
      animeRating: anime.averageRating
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Bulk sync all episode synopses for all anime
exports.syncAllEpisodesSynopses = async (req, res) => {
  try {
    const allAnime = await Anime.find({ malId: { $exists: true } });
    let totalUpdated = 0;
    let totalAdded = 0;
    let errors = [];

    for (const anime of allAnime) {
      try {
        const result = await exports.syncEpisodesFromJikan({ params: { id: anime._id } }, { 
          json: (data) => {
            totalUpdated += data.updated || 0;
            totalAdded += data.added || 0;
          }
        }, true); // Pass dummy res, and an extra arg not to really call res.json in subcalls
      } catch (err) {
        errors.push({ anime: anime.title, error: err.message });
      }
    }

    res.json({
      message: `Bulk sync done.`,
      totalUpdated,
      totalAdded,
      errorCount: errors.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: 'Bulk sync error', error: error.message });
  }
};


const kitsuService = require('../services/kituService');

exports.syncEpisodesFromJikan = async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id);
    if (!anime || !anime.malId) {
      return res.status(404).json({ message: 'Anime not found or missing MAL ID' });
    }

    console.log(`Syncing episodes for: ${anime.title}`);

    // Get episodes from Jikan (basic info)
    const jikanEpisodes = await jikanService.getAnimeEpisodes(anime.malId);

    // Try to get better episode data from Kitsu
    let kitsuEpisodes = [];
    try {
      const kitsuAnime = await kitsuService.searchAnime(anime.title);
      if (kitsuAnime.length > 0) {
        kitsuEpisodes = await kitsuService.getEpisodes(kitsuAnime[0].id);
      }
    } catch (error) {
      console.log('Kitsu fallback failed, using Jikan only');
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const jikanEp of jikanEpisodes) {
      const epNumber = jikanEp.mal_id || jikanEp.episode;

      // Find DB episode
      let dbEpisode = await Episode.findOne({ anime: anime._id, number: epNumber });

      // Find matching Kitsu episode
      const kitsuEp = kitsuEpisodes.find(ep =>
        ep.attributes.number === epNumber
      );

      const bestSynopsis = kitsuEp?.attributes?.synopsis
        || jikanEp.synopsis
        || `Episode ${epNumber} of ${anime.title}`;

      const bestTitle = jikanEp.title || kitsuEp?.attributes?.canonicalTitle || `Episode ${epNumber}`;

      const bestThumbnail = kitsuEp?.attributes?.thumbnail?.original || null;

      if (dbEpisode) {
        // --- Update existing episode's synopsis if empty or outdated ---
        let updated = false;
        if ((!dbEpisode.synopsis || dbEpisode.synopsis.trim() === '' || dbEpisode.synopsis.startsWith('Episode ')) && bestSynopsis) {
          dbEpisode.synopsis = bestSynopsis;
          updated = true;
        }
        if ((!dbEpisode.title || dbEpisode.title.startsWith('Episode')) && bestTitle) {
          dbEpisode.title = bestTitle;
          updated = true;
        }
        if (!dbEpisode.thumbnail && bestThumbnail) {
          dbEpisode.thumbnail = bestThumbnail;
          updated = true;
        }
        if (updated) {
          await dbEpisode.save();
          updatedCount++;
        }
      } else {
        // --- Create new episode if not exist ---
        const newEp = new Episode({
          anime: anime._id,
          number: epNumber,
          title: bestTitle,
          synopsis: bestSynopsis,
          airDate: jikanEp.aired ? new Date(jikanEp.aired) : undefined,
          duration: jikanEp.duration,
          thumbnail: bestThumbnail,
        });
        await newEp.save();
        anime.episodes.push(newEp._id);
        newCount++;
        console.log(`Added episode ${newEp.number}: ${newEp.title}`);
      }
    }

    await anime.save();
    res.json({
      message: `Added ${newCount}, updated ${updatedCount} episodes for ${anime.title}`,
      added: newCount,
      updated: updatedCount,
      sources: kitsuEpisodes.length > 0 ? ['Jikan', 'Kitsu'] : ['Jikan'],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing episodes', error: error.message });
  }
};

// Bulk sync all episode synopses for all anime
exports.syncAllEpisodesSynopses = async (req, res) => {
  try {
    const allAnime = await Anime.find({ malId: { $exists: true } });
    let totalUpdated = 0;
    let totalAdded = 0;
    let errors = [];

    for (const anime of allAnime) {
      try {
        const result = await exports.syncEpisodesFromJikan({ params: { id: anime._id } }, { 
          json: (data) => {
            totalUpdated += data.updated || 0;
            totalAdded += data.added || 0;
          }
        }, true); // Pass dummy res, and an extra arg not to really call res.json in subcalls
      } catch (err) {
        errors.push({ anime: anime.title, error: err.message });
      }
    }

    res.json({
      message: `Bulk sync done.`,
      totalUpdated,
      totalAdded,
      errorCount: errors.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: 'Bulk sync error', error: error.message });
  }
};


module.exports = {
  getAnimeList: exports.getAnimeList,
  getAnimeById: exports.getAnimeById,
  rateAnime: exports.rateAnime,
  rateEpisode: exports.rateEpisode,
  syncWithMAL: exports.syncWithMAL,
  syncAllEpisodesSynopses : exports.syncAllEpisodesSynopses,
  syncAllEpisodes: exports.syncAllEpisodes,
  syncEpisodesFromJikan: exports.syncEpisodesFromJikan,
  searchAnime: exports.searchAnime,
  updateAnimeDetails: exports.updateAnimeDetails
};

