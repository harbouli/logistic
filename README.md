# 🚚 LogistiMa - Moteur de Dispatching Express

> Système de dispatching haute performance pour la livraison express à Casablanca, capable de gérer des milliers de colis lors des pics de demande (Ramadan, Black Friday).

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Redis](https://img.shields.io/badge/Redis-7-red)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)

---

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Stack Technique](#-stack-technique)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [API Endpoints](#-api-endpoints)
- [Logique Métier](#-logique-métier)
- [Tests](#-tests)
- [Structure du Projet](#-structure-du-projet)

---

## ✨ Fonctionnalités

### 🎯 Smart Dispatcher (Contrôle de Concurrence)
Le cœur du système. Lorsqu'un colis est prêt, il est automatiquement attribué au livreur disponible le plus proche.

**Problème résolu** : Si 50 requêtes tentent d'assigner un colis au même livreur (qui n'a qu'une place), **une seule réussit**, les 49 autres reçoivent une erreur 409 (Conflict).

**Solution technique** :
- 🔒 **Verrou distribué Redis** (Redlock) - Empêche les race conditions entre instances
- 🔒 **Transaction PostgreSQL SERIALIZABLE** - Garantit l'intégrité au niveau base de données
- 🔒 **SELECT FOR UPDATE** - Verrouille la ligne du livreur pendant la transaction

### 📍 Cache des Zones Géographiques
Les zones de Casablanca (Anfa, Maarif, Gauthier, etc.) sont stockées dans Redis pour éviter des requêtes répétitives à PostgreSQL.

- TTL de 1 heure
- Invalidation automatique lors des modifications (hooks Sequelize)

### ⚡ Jobs Asynchrones (Background Workers)
Chaque dispatch déclenche des processus lourds qui s'exécutent en arrière-plan :

| Job | Durée | Description |
|-----|-------|-------------|
| Calcul d'itinéraire | ~2s | Simulation d'un appel API de routing (Google Maps, OSRM) |
| Génération de reçu | Immédiat | Création d'un reçu numérique + notification console |

Ces jobs sont gérés par **BullMQ** (basé sur Redis) et traités par un processus Worker séparé.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (curl, frontend)                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS API (Port 3000)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Routes     │──│ Controllers  │──│ DispatcherService    │   │
│  └──────────────┘  └──────────────┘  │ (Redlock + Transaction)│ │
│                                       └──────────┬─────────────┘ │
└──────────────────────────────────────────────────┼───────────────┘
                               │                   │
            ┌──────────────────┼───────────────────┼──────────────┐
            │                  │                   │              │
            ▼                  ▼                   ▼              ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  ┌──────────┐
    │  PostgreSQL  │   │    Redis     │   │    Redis     │  │  Redis   │
    │   Database   │   │    Cache     │   │    Locks     │  │  Queues  │
    │  (zones,     │   │  (zones:all) │   │ (lock:driver)│  │ (route,  │
    │   drivers,   │   │              │   │              │  │  receipt)│
    │   parcels,   │   └──────────────┘   └──────────────┘  └────┬─────┘
    │   deliveries)│                                              │
    └──────────────┘                                              │
                                                                  │
┌─────────────────────────────────────────────────────────────────┼───┐
│                       BULLMQ WORKER                             │   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │   │
│  │  RouteCalculationWorker │  │  ReceiptGenerationWorker│◄──────┘   │
│  │  (2s de calcul simulé)  │  │  (notification console) │           │
│  └─────────────────────────┘  └─────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ |
| Langage | TypeScript 5.x |
| Framework Web | Express.js |
| Base de données | PostgreSQL 15 |
| ORM | Sequelize 6 |
| Cache & Broker | Redis 7 |
| Queue de jobs | BullMQ |
| Verrous distribués | Redlock |
| Conteneurisation | Docker & Docker Compose |
| Tests | Jest + Supertest |
| CI/CD | GitHub Actions |

---

## 🚀 Installation

### Prérequis
- Docker & Docker Compose
- Node.js 20+ (pour le développement local)
- pnpm (recommandé) ou npm

### Démarrage rapide avec Docker

```bash
# Cloner le projet
git clone <repo-url>
cd logistic

# Démarrer toute l'infrastructure
docker-compose up -d

# Vérifier les logs
docker-compose logs -f api worker
```

L'API sera disponible sur `http://localhost:3000`

### Développement local

```bash
# Installer les dépendances
pnpm install

# Démarrer PostgreSQL et Redis
docker-compose up -d postgres redis

# Démarrer l'API (mode dev avec hot-reload)
pnpm run dev

# Dans un autre terminal, démarrer le Worker
pnpm run dev:worker
```

---

## 📖 Utilisation

### Test rapide avec le script

```bash
./test-manual.sh
```

Ce script va :
1. Créer une zone "Maarif"
2. Créer un livreur "Hassan"
3. Créer un colis
4. Dispatcher le colis au livreur

### Exemple de requêtes manuelles

```bash
# 1. Créer une zone
curl -X POST http://localhost:3000/api/zones \
  -H "Content-Type: application/json" \
  -d '{"name":"Anfa","centerLat":33.57,"centerLng":-7.59,"radius":5}'

# 2. Créer un livreur
curl -X POST http://localhost:3000/api/drivers \
  -H "Content-Type: application/json" \
  -d '{"name":"Mohamed","phone":"+212600000001","latitude":33.57,"longitude":-7.59,"capacity":5,"zoneId":"<ZONE_ID>"}'

# 3. Créer un colis
curl -X POST http://localhost:3000/api/parcels \
  -H "Content-Type: application/json" \
  -d '{"pickupAddress":"Rue Anfa","pickupLat":33.57,"pickupLng":-7.59,"deliveryAddress":"Twin Center","deliveryLat":33.59,"deliveryLng":-7.61,"weight":1.5,"zoneId":"<ZONE_ID>"}'

# 4. Dispatcher le colis (endpoint critique)
curl -X POST http://localhost:3000/api/parcels/<PARCEL_ID>/dispatch \
  -H "Content-Type: application/json" \
  -d '{"driverId":"<DRIVER_ID>"}'
```

---

## 📡 API Endpoints

### Health Check
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Vérifie que l'API est en ligne |

### Zones
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/zones` | Liste toutes les zones (depuis cache) |
| GET | `/api/zones/:id` | Récupère une zone par ID |
| POST | `/api/zones` | Crée une nouvelle zone |
| PUT | `/api/zones/:id` | Met à jour une zone |
| DELETE | `/api/zones/:id` | Supprime une zone |

### Livreurs (Drivers)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/drivers` | Liste tous les livreurs |
| GET | `/api/drivers/:id` | Récupère un livreur par ID |
| POST | `/api/drivers` | Crée un nouveau livreur |
| PATCH | `/api/drivers/:id` | Met à jour un livreur |
| DELETE | `/api/drivers/:id` | Supprime un livreur |

### Colis (Parcels)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/parcels` | Liste tous les colis |
| GET | `/api/parcels/:id` | Récupère un colis par ID |
| POST | `/api/parcels` | Crée un nouveau colis |
| PATCH | `/api/parcels/:id` | Met à jour un colis |
| **POST** | **`/api/parcels/:id/dispatch`** | **⚡ Dispatche le colis** |

### Livraisons (Deliveries)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/deliveries` | Liste toutes les livraisons |
| GET | `/api/deliveries/:id` | Récupère une livraison par ID |
| PATCH | `/api/deliveries/:id` | Met à jour le statut |

---

## 🧠 Logique Métier

### Flux de Dispatch

```
POST /api/parcels/:id/dispatch
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Vérifier que le colis existe et est en statut "pending" │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Trouver le livreur le plus proche (si non spécifié)     │
│    - Filtre par zone                                        │
│    - Filtre par statut "available"                          │
│    - Filtre par capacity > 0                                │
│    - Calcul de distance (formule de Haversine)              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Acquérir le verrou Redis sur le livreur                  │
│    🔒 redlock.acquire("lock:driver:<id>", 5000ms)           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Transaction PostgreSQL SERIALIZABLE                      │
│    ├── SELECT driver FOR UPDATE (verrouille la ligne)       │
│    ├── Vérifier capacity > 0 (sinon ConflictError)          │
│    ├── Décrémenter capacity                                 │
│    ├── Si capacity = 0, status = "busy"                     │
│    ├── UPDATE parcel (status = "assigned", driverId)        │
│    └── INSERT delivery                                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Libérer le verrou Redis                                  │
│    🔓 lock.release()                                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Ajouter les jobs à la queue (asynchrone)                 │
│    📦 routeQueue.add("calculate", {deliveryId})             │
│    📧 receiptQueue.add("generate", {deliveryId})            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
      RÉPONSE 201 Created
```

### Gestion de la Concurrence

Lorsque 50 requêtes simultanées tentent de dispatcher vers le même livreur (capacity=1) :

1. **Redlock** permet à une seule requête d'acquérir le verrou
2. Les 49 autres attendent ou échouent ("Could not acquire lock")
3. La requête qui a le verrou exécute la transaction
4. Elle décrémente la capacité à 0 et passe le status à "busy"
5. Les requêtes suivantes qui acquièrent le verrou voient capacity=0 → ConflictError

**Résultat** : 1 succès (201), 49 conflits (409)

---

## 🧪 Tests

### Exécuter tous les tests

```bash
# Avec Docker démarré
DB_PORT=5433 pnpm test
```

### Test de stress (50 requêtes concurrentes)

```bash
DB_PORT=5433 pnpm run test:stress
```

### Résultat attendu

```
📊 STRESS TEST RESULTS:
   ✅ Successes (201): 1     
   ⚠️  Conflicts (409): 49  
   ❓ Not Found (404): 0     
   ❌ Errors (500): 0        

✅ STRESS TEST PASSED: Only 1 parcel was dispatched!
```

### Test d'isolation (Worker arrêté)

```bash
# Arrêter le worker
docker-compose stop worker

# Dispatcher un colis
curl -X POST http://localhost:3000/api/parcels/<ID>/dispatch

# Les jobs sont stockés dans Redis (pas perdus)
# Redémarrer le worker pour les traiter
docker-compose start worker
```

---

## 📁 Structure du Projet

```
logistic/
├── src/
│   ├── config/
│   │   ├── database.ts      # Connexion PostgreSQL (Sequelize)
│   │   ├── redis.ts         # Client Redis + Redlock
│   │   └── queues.ts        # Queues BullMQ
│   ├── models/
│   │   ├── Zone.ts          # Zones de livraison
│   │   ├── Driver.ts        # Livreurs
│   │   ├── Parcel.ts        # Colis
│   │   ├── Delivery.ts      # Livraisons
│   │   └── index.ts         # Export centralisé
│   ├── services/
│   │   ├── DispatcherService.ts  # 🎯 Logique de dispatch
│   │   ├── ZoneCacheService.ts   # Cache Redis des zones
│   │   └── index.ts
│   ├── controllers/
│   │   ├── zoneController.ts
│   │   ├── driverController.ts
│   │   ├── parcelController.ts
│   │   ├── deliveryController.ts
│   │   └── index.ts
│   ├── jobs/
│   │   ├── routeCalculation.ts   # Worker calcul d'itinéraire
│   │   ├── receiptGeneration.ts  # Worker génération reçu
│   │   └── index.ts
│   ├── routes/
│   │   └── index.ts         # Définition des routes Express
│   ├── __tests__/
│   │   ├── setup.ts         # Configuration Jest
│   │   ├── dispatcher.test.ts
│   │   ├── stress.test.ts   # 🔥 Test 50 requêtes
│   │   └── zoneCache.test.ts
│   ├── app.ts               # Point d'entrée API
│   └── worker.ts            # Point d'entrée Worker
├── docs/
│   └── class-diagram.md     # Diagramme UML Mermaid
├── docker-compose.yml       # Orchestration Docker
├── Dockerfile               # Build multi-stage
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## 🐳 Services Docker

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `api` | Build local | 3000 | API Express |
| `worker` | Build local | - | BullMQ Worker |
| `postgres` | postgres:15-alpine | 5433 | Base de données |
| `redis` | redis:7-alpine | 6379 | Cache + Queues + Locks |

---

## 📝 Licence

MIT

---

## 👥 Auteurs

- Équipe Backend LogistiMa
