const { db } = require('../util/admin');

exports.getAllJobs = (req, res) => {
  db.collection('jobs')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
      let jobs = [];
      data.forEach((doc) => {
        jobs.push({
          jobId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(jobs);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneJob = (req, res) => {
  if (req.body.body.trim() === '') {
    return res.status(400).json({ body: 'Body must not be empty' });
  }

  const newJob = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };

  db.collection('jobs')
    .add(newJob)
    .then((doc) => {
      const resJob = newJob;
      resJob.jobId = doc.id;
      res.json(resJob);
    })
    .catch((err) => {
      res.status(500).json({ error: 'something went wrong' });
      console.error(err);
    });
};
// Fetch one job
exports.getJob = (req, res) => {
  let jobData = {};
  db.doc(`/jobs/${req.params.jobId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      jobData = doc.data();
      jobData.jobId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('jobId', '==', req.params.jobId)
        .get();
    })
    .then((data) => {
      jobData.comments = [];
      data.forEach((doc) => {
        jobData.comments.push(doc.data());
      });
      return res.json(jobData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Comment on a comment
exports.commentOnJob = (req, res) => {
  if (req.body.body.trim() === '')
    return res.status(400).json({ comment: 'Must not be empty' });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    jobId: req.params.jobId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  console.log(newComment);

  db.doc(`/jobs/${req.params.jobId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: 'Something went wrong' });
    });
};
// Like a job
exports.likeJob = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('jobId', '==', req.params.jobId)
    .limit(1);

  const jobDocument = db.doc(`/jobs/${req.params.jobId}`);

  let jobData;

  jobDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        jobData = doc.data();
        jobData.jobId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Job not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            jobId: req.params.jobId,
            userHandle: req.user.handle
          })
          .then(() => {
            jobData.likeCount++;
            return jobDocument.update({ likeCount: jobData.likeCount });
          })
          .then(() => {
            return res.json(jobData);
          });
      } else {
        return res.status(400).json({ error: 'Job already liked' });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeJob = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('jobId', '==', req.params.jobId)
    .limit(1);

  const jobDocument = db.doc(`/jobs/${req.params.jobId}`);

  let jobData;

  jobDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        jobData = doc.data();
        jobData.jobId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Job not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: 'Job not liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            jobData.likeCount--;
            return jobDocument.update({ likeCount: jobData.likeCount });
          })
          .then(() => {
            res.json(jobData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Delete a job
exports.deleteJob = (req, res) => {
  const document = db.doc(`/jobs/${req.params.jobId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: 'Unauthorized' });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: 'Job deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
