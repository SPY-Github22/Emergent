

class Trainer {
    constructor(world, nn) {
        this.world = world;
        this.nn = nn;
        this.maxSize = 500;
        this.batchSize = 32;
        this.samples = []; 
        
        this.dbName = 'EmergentTrainerDB';
        this.dbVersion = 1;
        this.storeName = 'training_samples';
        this.db = null;

        this.initDB().then(() => {
            return this.loadSamples();
        });

        this.nn.load();

        events.on('ACTION_TAKEN', this.handleActionTaken.bind(this));

        setInterval(() => this.trainTask(), 5000);
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'dbId', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    async loadSamples() {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = (e) => {
                let results = e.target.result || [];
                if (results.length > this.maxSize) {
                    const toDelete = results.length - this.maxSize;
                    const itemsToDelete = results.slice(0, toDelete);
                    results = results.slice(toDelete);
                    
                    itemsToDelete.forEach(item => store.delete(item.dbId));
                }
                this.samples = [...results, ...this.samples].slice(-this.maxSize);
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    async handleActionTaken(data) {
        const { action, stateSnapshot } = data;
        
        const sample = {
            action: action,
            state: {
                ...stateSnapshot,
                isDay: this.world.isDay
            },
            timestamp: Date.now()
        };

        if (this.db) {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(sample);
            
            request.onsuccess = (e) => {
                sample.dbId = e.target.result;
                this.samples.push(sample);
                
                if (this.samples.length > this.maxSize) {
                    const oldest = this.samples.shift();
                    if (oldest.dbId !== undefined) {
                        const delTransaction = this.db.transaction([this.storeName], 'readwrite');
                        delTransaction.objectStore(this.storeName).delete(oldest.dbId);
                    }
                }
            };
            
            request.onerror = (e) => {
                console.error("Trainer: Failed to add sample to DB", e);
            };
        } else {
            this.samples.push(sample);
            if (this.samples.length > this.maxSize) {
                this.samples.shift();
            }
        }
    }

    async trainTask() {
        if (this.samples.length < 10) return;
        if (this.nn.isTraining) return;

        const batchSize = Math.min(this.batchSize, this.samples.length);
        const batch = [];
        const indices = new Set();
        
        while (batch.length < batchSize) {
            const idx = Math.floor(Math.random() * this.samples.length);
            if (!indices.has(idx)) {
                indices.add(idx);
                batch.push(this.samples[idx]);
            }
        }

        const xTrain = [];
        const yTrain = [];

        for (const sample of batch) {
            const actionIdx = this.nn.actions.indexOf(sample.action);
            if (actionIdx === -1) continue;

            const s = sample.state;
            
            xTrain.push([
                (s.position && s.position.x ? s.position.x : 0) / 800,
                (s.position && s.position.y ? s.position.y : 0) / 600,
                (s.direction && s.direction.x !== undefined ? s.direction.x : 0),
                (s.direction && s.direction.y !== undefined ? s.direction.y : 0),
                (s.hunger !== undefined ? s.hunger : 0) / 100,
                (s.social !== undefined ? s.social : 0) / 100,
                s.isDay ? 1 : 0
            ]);

            const y = [0, 0, 0, 0, 0];
            y[actionIdx] = 1;
            yTrain.push(y);
        }

        await this.nn.train(xTrain, yTrain);
    }
}
