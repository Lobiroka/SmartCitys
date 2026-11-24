import { mapPolygons } from './mapPolygons';
import type { InundationArea } from './Inundation';

const area:InundationArea={id:'1',classe:'Alta',ano:2014,descricaoFonte:null,fonte:'SGB',
    dataExtracao:'2026-11-19T12:00:00Z',bbox:[-35,-9,-34,-8],geometry:{type:'MultiPolygon',coordinates:[[
        [[-35,-9],[-34,-9],[-34,-8],[-35,-9]],
        [[-34.8,-8.8],[-34.7,-8.8],[-34.7,-8.7],[-34.8,-8.8]],
    ],[[[-34.4,-8.4],[-34.3,-8.4],[-34.3,-8.3],[-34.4,-8.4]]]]}};
it('converte longitude/latitude, preserva buracos e separa multipolígonos',()=>{
    const polygons=mapPolygons([area],{latitude:-8.5,longitude:-34.5,latitudeDelta:2,longitudeDelta:2});
    expect(polygons).toHaveLength(2);
    expect(polygons[0].coordinates[0]).toEqual({latitude:-9,longitude:-35});
    expect(polygons[0].holes).toHaveLength(1);
    expect(polygons[0].holes[0][0]).toEqual({latitude:-8.8,longitude:-34.8});
    expect(polygons[1].holes).toEqual([]);
});
it('filtra áreas fora da janela sem transformar ausência em classe baixa',()=>{
    expect(mapPolygons([area],{latitude:0,longitude:0,latitudeDelta:1,longitudeDelta:1})).toEqual([]);
    expect(mapPolygons([],{latitude:-8.5,longitude:-34.5,latitudeDelta:2,longitudeDelta:2})).toEqual([]);
});
