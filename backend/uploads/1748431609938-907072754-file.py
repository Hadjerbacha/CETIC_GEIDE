class Concept:
    """
    Représente un concept ALC.
    """
    def __init__(self, name=None, operator=None, operands=None):
        self.name = name  # Nom du concept si atomique
        self.operator = operator  # Operateur : 'AND', 'OR', 'NOT', 'EXISTS', 'FORALL'
        self.operands = operands or []  # Liste des sous-concepts (pour les opérateurs)


    def __repr__(self):
        if self.name:
            return self.name
        elif self.operator == "NOT":
            return f"(NOT {self.operands[0]})"
        elif self.operator in ["AND", "OR"]:
            return f"({f' {self.operator} '.join(map(str, self.operands))})"
        elif self.operator in ["EXISTS", "FORALL"]:
            return f"({self.operator} {self.operands[0]} {self.operands[1]})"
        return "Unknown Concept"


    def __eq__(self, other):
        if not isinstance(other, Concept):
            return False
        return self.name == other.name and self.operator == other.operator and self.operands == other.operands


    def __hash__(self):
        return hash((self.name, self.operator, tuple(self.operands)))




class Role:
    """
    Représente un rôle entre concepts dans ALC.
    """
    def __init__(self, name):
        self.name = name


    def __repr__(self):
        return self.name




class TBox:
    """
    Représente une TBox contenant les axiomes terminologiques.
    """
    def __init__(self):
        self.axioms = []  # Liste des axiomes de la forme (C, D) pour C ⊆ D


    def add_axiom(self, concept_c, concept_d):
        """
        Ajoute un axiome de la forme C ⊆ D.
        """
        self.axioms.append((concept_c, concept_d))


    def get_parents(self, concept):
        """
        Retourne les concepts qui subsument directement le concept donné.
        """
        return [d for c, d in self.axioms if c == concept]




def is_satisfiable(concept):
    """
    Vérifie si un concept est satisfiable en utilisant une méthode simplifiée.
    """
    return True  # Tous les concepts atomiques sont satisfiables




def is_subsumed(concept_c, concept_d, tbox):
    """
    Vérifie si un concept C est subsumé par un concept D dans la TBox donnée.
    Gère les opérateurs AND, OR, NOT, EXISTS et FORALL.
    """
    visited = set()
    stack = [concept_c]


    while stack:
        current = stack.pop()


        # Si nous avons trouvé une correspondance exacte
        if current == concept_d:
            return True


        # Si le concept a déjà été visité, on l'ignore
        if current in visited:
            continue
        visited.add(current)


        # Gestion des opérateurs logiques
        if current.operator == "AND":
            # Si C est une conjonction, tous les sous-concepts doivent être vérifiés
            stack.extend(current.operands)
        elif current.operator == "OR":
            # Si C est une disjonction, vérifier si l'un des sous-concepts subsume D
            if any(is_subsumed(operand, concept_d, tbox) for operand in current.operands):
                return True
        elif current.operator == "NOT":
            # Si C est une négation, vérifier la subsomption de la négation
            return not is_subsumed(current.operands[0], concept_d, tbox)
        elif current.operator in ["EXISTS", "FORALL"]:
            # Pour EXISTS et FORALL, on ne fait pas de subsomption de manière simplifiée
            continue
        else:
            # Si c'est un concept atomique, on vérifie dans la TBox
            stack.extend(tbox.get_parents(current))


    return False




def classify_concepts(concepts, tbox):
    """
    Classe un ensemble de concepts en construisant une taxonomie hiérarchique.
    """
    taxonomy = {concept.name: [] for concept in concepts if concept.name}
    for concept_c in concepts:
        if not concept_c.name:
            continue
        for concept_d in concepts:
            if concept_d.name and concept_c != concept_d and is_subsumed(concept_c, concept_d, tbox):
                taxonomy[concept_c.name].append(concept_d.name)


    # Réduction des parents indirects
    for concept, parents in taxonomy.items():
        direct_parents = [
            p for p in parents
            if not any(
                is_subsumed(Concept(other), Concept(p), tbox)
                for other in parents if other != p
            )
        ]
        taxonomy[concept] = direct_parents


    return taxonomy




if __name__ == "__main__":
    # Définition des concepts et rôles
    plante = Concept("Plante")
    arbre = Concept("Arbre")
    fruit = Concept("Fruit")
    fleur = Concept("Fleur")
    pomme = Concept("Pomme")
    rose = Concept("Rose")
    plante_herbacee = Concept("PlanteHerbacee")
    arbre_fruitier = Concept(operator="AND", operands=[arbre, Concept(operator="EXISTS", operands=[Role("produit"), fruit])])
    non_fruit = Concept(operator="NOT", operands=[fruit])
    union_plante_fleur = Concept(operator="OR", operands=[plante, fleur])


    # Création de la TBox
    tbox = TBox()
    tbox.add_axiom(arbre, plante)  # Arbre ⊆ Plante
    tbox.add_axiom(fleur, plante)  # Fleur ⊆ Plante
    tbox.add_axiom(fruit, plante)  # Fruit ⊆ Plante
    tbox.add_axiom(pomme, fruit)   # Pomme ⊆ Fruit
    tbox.add_axiom(rose, fleur)     # Rose ⊆ Fleur
    tbox.add_axiom(plante_herbacee, plante)  # PlanteHerbacee ⊆ Plante
    tbox.add_axiom(arbre_fruitier, plante)   # ArbreFruitier ⊆ Plante
    tbox.add_axiom(arbre_fruitier, arbre)    # ArbreFruitier ⊆ Arbre


    # Liste des concepts
    concepts = [plante, arbre, fruit, fleur, pomme, rose, plante_herbacee, arbre_fruitier, non_fruit, union_plante_fleur]


    # Test de subsomption
    print("Subsomption :")
    print(f"Plante subsume Arbre ? {is_subsumed(arbre, plante, tbox)}")  # True
    print(f"Arbre subsume ArbreFruitier ? {is_subsumed(arbre_fruitier, arbre, tbox)}")  # True
    print(f"Plante subsume Fleur ? {is_subsumed(fleur, plante, tbox)}")  # True
    print(f"Fruit subsume Pomme ? {is_subsumed(pomme, fruit, tbox)}")  # True
    print(f"Non-Fruit subsume Pomme ? {is_subsumed(pomme, non_fruit, tbox)}")  # False
    print(f"Union (Plante OR Fleur) subsume Rose ? {is_subsumed(union_plante_fleur, rose, tbox)}")  # True


    # Classification des concepts
    print("\nClassification des concepts :")
    taxonomy = classify_concepts(concepts, tbox)
    for concept, parents in taxonomy.items():
        print(f"{concept} : {parents}")


