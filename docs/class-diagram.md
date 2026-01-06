# LogistiMa - Diagramme des Tables avec Méthodes Controllers

```mermaid
classDiagram
    direction LR

    class Zone {
        +UUID id
        +string name
        +decimal centerLat
        +decimal centerLng
        +decimal radius
        +Date createdAt
        +Date updatedAt
        --
        +getAll() GET /api/zones
        +getById(id) GET /api/zones/:id
        +create(data) POST /api/zones
        +update(id, data) PUT /api/zones/:id
        +delete(id) DELETE /api/zones/:id
    }

    class Driver {
        +UUID id
        +string name
        +string phone
        +decimal latitude
        +decimal longitude
        +int capacity
        +enum status
        +UUID zoneId
        +Date createdAt
        +Date updatedAt
        --
        +getAll() GET /api/drivers
        +getById(id) GET /api/drivers/:id
        +create(data) POST /api/drivers
        +update(id, data) PATCH /api/drivers/:id
        +delete(id) DELETE /api/drivers/:id
    }

    class Parcel {
        +UUID id
        +string trackingCode
        +enum status
        +string pickupAddress
        +decimal pickupLat
        +decimal pickupLng
        +string deliveryAddress
        +decimal deliveryLat
        +decimal deliveryLng
        +decimal weight
        +UUID zoneId
        +UUID driverId
        +Date createdAt
        +Date updatedAt
        --
        +getAll() GET /api/parcels
        +getById(id) GET /api/parcels/:id
        +create(data) POST /api/parcels
        +update(id, data) PATCH /api/parcels/:id
        +dispatch(id) POST /api/parcels/:id/dispatch
    }

    class Delivery {
        +UUID id
        +UUID parcelId
        +UUID driverId
        +enum status
        +text estimatedRoute
        +bool receiptGenerated
        +Date startedAt
        +Date completedAt
        +Date createdAt
        +Date updatedAt
        --
        +getAll() GET /api/deliveries
        +getById(id) GET /api/deliveries/:id
        +update(id, data) PATCH /api/deliveries/:id
    }

    %% ASSOCIATIONS (objets indépendants, peuvent exister séparément)
    Zone "1" --> "*" Driver : belongs to
    Zone "1" --> "*" Parcel : located in
    Driver "1" --> "0..*" Parcel : assigned to
    Driver "1" --> "*" Delivery : performs

    %% COMPOSITION (Delivery ne peut pas exister sans Parcel)
    Parcel "1" *-- "0..1" Delivery : creates
```

## Légende des Relations UML

| Symbole | Type | Signification |
|---------|------|---------------|
| `-->` | **Association** | Relation simple, les objets existent indépendamment |
| `--o` | **Agrégation** | "Has-a", l'enfant peut exister sans le parent |
| `*--` | **Composition** | Relation forte, l'enfant ne peut pas exister sans le parent |

## Relations du Projet

| Relation | Type | Cardinalité | Explication |
|----------|------|-------------|-------------|
| Zone → Driver | Association | 1:N | Un driver appartient à une zone (FK obligatoire) |
| Zone → Parcel | Association | 1:N | Un colis est localisé dans une zone |
| Driver → Parcel | Association | 1:0..N | Un driver peut avoir 0 ou plusieurs colis assignés |
| Driver → Delivery | Association | 1:N | Un driver effectue plusieurs livraisons |
| Parcel → Delivery | **Composition** | 1:0..1 | La delivery est créée à partir du parcel et ne peut exister sans lui |

## Résumé des Endpoints par Table

| Table | Méthode | Endpoint | Description |
|-------|---------|----------|-------------|
| **Zone** | GET | `/api/zones` | Liste toutes les zones (depuis cache Redis) |
| | GET | `/api/zones/:id` | Récupère une zone par ID |
| | POST | `/api/zones` | Crée une nouvelle zone |
| | PUT | `/api/zones/:id` | Met à jour une zone |
| | DELETE | `/api/zones/:id` | Supprime une zone |
| **Driver** | GET | `/api/drivers` | Liste tous les livreurs |
| | GET | `/api/drivers/:id` | Récupère un livreur par ID |
| | POST | `/api/drivers` | Crée un nouveau livreur |
| | PATCH | `/api/drivers/:id` | Met à jour un livreur |
| | DELETE | `/api/drivers/:id` | Supprime un livreur |
| **Parcel** | GET | `/api/parcels` | Liste tous les colis |
| | GET | `/api/parcels/:id` | Récupère un colis par ID |
| | POST | `/api/parcels` | Crée un nouveau colis |
| | PATCH | `/api/parcels/:id` | Met à jour un colis |
| | **POST** | **`/api/parcels/:id/dispatch`** | **Dispatche le colis à un livreur** |
| **Delivery** | GET | `/api/deliveries` | Liste toutes les livraisons |
| | GET | `/api/deliveries/:id` | Récupère une livraison par ID |
| | PATCH | `/api/deliveries/:id` | Met à jour le statut d'une livraison |

## Enums

| Enum | Valeurs |
|------|---------|
| `DriverStatus` | `available`, `busy`, `offline` |
| `ParcelStatus` | `pending`, `assigned`, `in_transit`, `delivered`, `cancelled` |
| `DeliveryStatus` | `pending`, `in_progress`, `completed`, `failed` |
