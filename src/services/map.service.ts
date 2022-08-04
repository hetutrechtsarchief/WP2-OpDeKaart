import mapboxgl from "mapbox-gl";
import {MarkerPropertiesModel} from "../models/marker-properties.model";
import {store} from "../store";

export class MapService {
    private static _instance: MapService;

    // @ts-ignore
    private _map: mapboxgl.Map;
    private readonly _geoJsonUrl = '/adressen.geojson';

    constructor() {
        if(MapService._instance) {
            return MapService._instance
        }
        MapService._instance = this;
    }

    private async _getGeoJsonFromUrl(url: string): Promise<any> {
        const geoJsonResponse: Response = await fetch(url);
        const geoJson = await geoJsonResponse.json();
        return Promise.resolve(geoJson);
    }

    async initialize(map: mapboxgl.Map): Promise<void> {
        this._map = map;

        const geoJson = await this._getGeoJsonFromUrl(this._geoJsonUrl);
        store.commit("map/setGeoJson", geoJson);
        console.log(geoJson);

        // @ts-ignore
        this._map.addSource('markers-source', {
            type: 'geojson',
            data: geoJson,
            cluster: true,
            clusterMaxZoom: 14, // Max zoom to cluster points on
            clusterRadius: 50 // Radius of each cluster when clustering points
        });

        this._map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'markers-source',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    100,
                    '#f1f075',
                    750,
                    '#f28cb1'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100,
                    30,
                    750,
                    40
                ]
            }
        });

        this._map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'markers-source',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });

        this._map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'markers-source',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['get', 'marker-color'],
                'circle-radius': 7,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        this._map.on('click', 'clusters', (e: any) => {
            const features = this._map.queryRenderedFeatures(e.point, {
                layers: ['clusters']
            });
            // @ts-ignore
            const clusterId = features[0].properties.cluster_id;
            // @ts-ignore
            this._map.getSource('markers-source').getClusterExpansionZoom(
                clusterId,
                (err: any, zoom: any) => {
                    if (err) return;

                    this._map.easeTo({
                        center: (features[0].geometry as any).coordinates,
                        zoom: zoom
                    });
                }
            );
        });

        this._map.on('mouseenter', 'clusters', () => {
            this._map.getCanvas().style.cursor = 'pointer !important';
        });
        this._map.on('mouseleave', 'clusters', () => {
            this._map.getCanvas().style.cursor = '';
        });


        this._map.on('click', 'unclustered-point', (e: any) => {
            e.preventDefault();

            this._onMapMarkerClicked(e);

            const markerProperties: MarkerPropertiesModel = this._getMarkerProperties(e);
            store.commit("selectItem", {
                img: {url: "https://via.placeholder.com/1000x200", alt: "Alt"},
                label: markerProperties.straatnaam
            })
        });

        this._map.on('click', (e: any) => {
            if (e.defaultPrevented) {
                return;
            }
            store.commit("deselectItem");
        });
    }

    _onMapMarkerClicked(e: any) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const streetName: string = this._getMarkerProperties(e).straatnaam;

        // Ensure that if the map is zoomed out such that
        // multiple copies of the feature are visible, the
        // popup appears over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup({closeButton: false, closeOnClick: true, closeOnMove: false})
            .setLngLat(coordinates)
            .setHTML(
                `${streetName}`
            )
            .addTo(this._map);
    }

    private _getMarkerProperties(e: any): MarkerPropertiesModel {
        return e.features[0].properties;
    }

    async updateStreetFilter(streetFilter: string) {
        const geoJson = store.getters["map/getGeoJson"];
        const filteredGeoJson: any = {"type": "FeatureCollection", "features": []};
        for (const feature of geoJson["features"]) {
            const street: string = feature?.properties?.straatnaam.toLowerCase()
            if(street.includes(streetFilter.toLowerCase())) {
                filteredGeoJson.features.push(feature);
            }
        }
        (this._map.getSource('markers-source') as any).setData(filteredGeoJson);
    }
}