// controllers/adminController.js
const Anime = require('../models/Anime');
const Episode = require('../models/Episode');
const csv = require('csv-parser');
const fs = require('fs');

exports.createAnime = async (req, res) => {
  const anime = new Anime({ ...req.body, createdBy: req.user._id });
  await anime.save();
  res.json(anime);
};

exports.updateAnime = async (req, res) => {
  const anime = await Anime.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(anime);
};

exports.deleteAnime = async (req, res) => {
  await Anime.findByIdAndDelete(req.params.id);
  res.json({ message: 'Anime deleted' });
};

exports.addEpisode = async (req, res) => {
  const episode = new Episode({ ...req.body, anime: req.params.id });
  await episode.save();
  res.json(episode);
};

exports.updateEpisode = async (req, res) => {
  const ep = await Episode.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(ep);
};

exports.bulkUpload = async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (const row of results) {
        await Anime.create(row);
      }
      res.json({ message: 'Bulk upload complete', count: results.length });
    });
};

exports.createEmployee = async (req, res) => {
  const User = require('../models/User');
  const emp = new User({ ...req.body, password: Math.random().toString(36).slice(-8) });
  await emp.save();
  res.json(emp);
};


exports.syncEpisodesFromJikan = async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id);
    if (!anime || !anime.malId) {
      return res.status(404).json({ message: 'Anime not found or missing MAL ID' });
    }

    const jikanEpisodes = await jikanService.getAnimeEpisodes(anime.malId);
    let count = 0;

    for (const ep of jikanEpisodes) {
      const exists = await Episode.findOne({ anime: anime._id, number: ep.mal_id });
      if (!exists) {
        const newEp = new Episode({
          anime: anime._id,
          number: ep.mal_id,
          title: ep.title || `Episode ${ep.mal_id}`,
          synopsis: ep.synopsis,
          airDate: ep.aired ? new Date(ep.aired) : undefined,
          duration: ep.duration,
        });
        await newEp.save();
        anime.episodes.push(newEp._id);
        count++;
      }
    }
    await anime.save();
    res.json({ message: `Synced ${count} episodes`, total: count });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing episodes', error: error.message });
  }
};

// backend/controllers/adminController.js
exports.getStats = async (req, res) => {
  try {
    console.log('Fetching stats...');
    const User = require('../models/User');
    const Rating = require('../models/Rating');
    // const Download = require('../models/Download'); // assume you track downloads

    const userLogins = await User.countDocuments(); 
    const ratingsSubmitted = await Rating.countDocuments();
    // const userDownloads = await Download.countDocuments();
    console.log(userLogins, ratingsSubmitted, userDownloads);
    res.json({
      userLogins,
      ratingsSubmitted,
      // userDownloads,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};
