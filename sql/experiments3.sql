select * from dbpedia_shacl.classes
where id in (58028,58050,58143)
--where iri in ('http://dbpedia.org/ontology/Island', 'http://dbpedia.org/ontology/Country')
where iri = 'http://dbpedia.org/ontology/City'

select * from dbpedia_shacl.properties
where iri = 'http://dbpedia.org/ontology/country'

--163109
select * from dbpedia_shacl.cp_rels
where property_id = 18532 and class_id in (58028,58050,58143)

insert into dbpedia_shacl.cp_rels (class_id, property_id, type_id, cnt, object_cnt, cover_set_index, add_link_slots, details_level, sub_cover_complete)
values (58143, 18532, 1, 1, 1, 0, 1, 2, true)

select * from dbpedia_shacl.cp_rel_types

--58050 58143
select * from dbpedia_shacl.cpc_rels
delete from dbpedia_shacl.cpc_rels
where id = 2

--172958
--172959

insert into dbpedia_shacl.cpc_rels (cp_rel_id, other_class_id, cnt)
values (163109, 58050, 1);

insert into dbpedia_shacl.cpc_rels (cp_rel_id, other_class_id, cnt)
values (163109, 58143, 1);



insert into dbpedia_shacl.cpc_rels (cp_rel_id, other_class_id, cnt)
values (172958, 58028, 1);

insert into dbpedia_shacl.cpc_rels (cp_rel_id, other_class_id, cnt)
values (172959, 58028, 1);


-- [propertijs] class -> property -> cp_rels (type2)
-- [saite] cpc_rels(other_class) -> cp_rels (type1) -> targetClass

delete from dbpedia_shacl.cp_rels;
delete from dbpedia_shacl.properties;
delete from dbpedia_shacl.classes;


update dbpedia_shacl.properties
set ns_id=1
where iri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

select * from dbpedia_shacl.v_classes_ns_main 

SELECT v.*, case when p.cover_set_index > 0 then 2 else 1 end as principal_class
FROM dbpedia_shacl.v_classes_ns_main v JOIN dbpedia_shacl.cp_rels p ON
p.class_id = v.id and p.type_id = 1 and p.property_id = 18532 and p.details_level > 0
JOIN dbpedia_shacl.cpc_rels cp on cp.cp_rel_id = p.id and cp.other_class_id = 58028
) aa order by  cnt desc LIMIT $1